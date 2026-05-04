"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { reports, reviews, comments, maps } from "@/db/schema";
import { requireAdminId, requireUserId } from "@/lib/auth-helpers";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_REASON = 280;

/** Submit a user-facing report for a review or comment. Idempotent on
 * (reporter, target) — submitting twice updates the reason. */
export async function reportContent(input: {
  targetType: "review" | "comment";
  targetId: number;
  reason: string;
  slug: string;
}): Promise<ActionResult> {
  const auth = await requireUserId("Sign in to report.");
  if (!auth.ok) return auth;
  const reporterId = auth.userId;

  const reason = input.reason.trim().slice(0, MAX_REASON);
  if (!reason) return { ok: false, error: "Add a short reason." };

  // Validate that the target actually exists so we don't accumulate
  // dangling reports.
  if (input.targetType === "review") {
    const [r] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, input.targetId))
      .limit(1);
    if (!r) return { ok: false, error: "Review not found." };
  } else {
    const [c] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.id, input.targetId))
      .limit(1);
    if (!c) return { ok: false, error: "Comment not found." };
  }

  await db
    .insert(reports)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId,
      reason,
    })
    .onConflictDoUpdate({
      target: [reports.reporterId, reports.targetType, reports.targetId],
      set: { reason, createdAt: new Date(), resolvedAt: null },
    });

  // No revalidation needed — reports are admin-only data.
  return { ok: true };
}

/** Admin-only soft-delete a review. Preserves reactions/comments
 * underneath; the body just renders as a placeholder. */
export async function adminSoftDeleteReview(input: {
  reviewId: number;
  slug: string;
}): Promise<ActionResult> {
  const r = await requireAdminId();
  if (!r.ok) return r;

  await db
    .update(reviews)
    .set({ deletedAt: new Date() })
    .where(eq(reviews.id, input.reviewId));

  // Mark all open reports against this review as resolved.
  await db
    .update(reports)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(reports.targetType, "review"),
        eq(reports.targetId, input.reviewId)
      )
    );

  revalidatePath(`/maps/${input.slug}`);
  return { ok: true };
}

/** Mirror for comments. Same shape so the UI just dispatches by type. */
export async function adminSoftDeleteComment(input: {
  commentId: number;
  slug: string;
}): Promise<ActionResult> {
  const r = await requireAdminId();
  if (!r.ok) return r;

  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(eq(comments.id, input.commentId));

  await db
    .update(reports)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(reports.targetType, "comment"),
        eq(reports.targetId, input.commentId)
      )
    );

  revalidatePath(`/maps/${input.slug}`);
  return { ok: true };
}

/** Resolve all reports for a target without deleting it (= "false
 * alarm"). Admin-only. Keeps the row history. */
export async function adminDismissReports(input: {
  targetType: "review" | "comment";
  targetId: number;
}): Promise<ActionResult> {
  const r = await requireAdminId();
  if (!r.ok) return r;

  await db
    .update(reports)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId)
      )
    );
  // Map slug not strictly needed — admin views don't live on detail.
  void maps;
  return { ok: true };
}
