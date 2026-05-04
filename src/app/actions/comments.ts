"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { comments, reviews, maps } from "@/db/schema";
import { isAdmin } from "@/lib/admin";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const MAX_BODY = 800;

/** Rate-limit window: one comment per user per (review, ~30s).
 * Cheap defense-in-depth; full rate limiter is roadmap-tier. */
const COMMENT_DEBOUNCE_SECONDS = 20;

export async function createComment(input: {
  reviewId: number;
  body: string;
  slug: string;
}): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in to comment." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Comment can't be empty." };
  if (body.length > MAX_BODY)
    return { ok: false, error: `Comment too long (max ${MAX_BODY}).` };

  // Make sure the review exists and isn't soft-deleted.
  const [review] = await db
    .select({ id: reviews.id, deletedAt: reviews.deletedAt })
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  if (!review) return { ok: false, error: "Review not found." };
  if (review.deletedAt)
    return { ok: false, error: "This review is closed for comments." };

  // Cheap dedup: reject identical body within the debounce window.
  const recent = await db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt })
    .from(comments)
    .where(
      and(eq(comments.reviewId, input.reviewId), eq(comments.userId, userId))
    )
    .orderBy(comments.createdAt)
    .limit(5);
  const cutoff = Date.now() - COMMENT_DEBOUNCE_SECONDS * 1000;
  const duplicate = recent.find(
    (r) => r.body === body && r.createdAt.getTime() > cutoff
  );
  if (duplicate) return { ok: false, error: "Posted that already." };

  const [inserted] = await db
    .insert(comments)
    .values({ reviewId: input.reviewId, userId, body })
    .returning({ id: comments.id });

  revalidatePath(`/maps/${input.slug}`);
  return { ok: true, data: { id: inserted.id } };
}

/** Author hard-delete OR admin soft-delete depending on caller. */
export async function deleteComment(input: {
  commentId: number;
  slug: string;
}): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in required." };

  const [c] = await db
    .select({ id: comments.id, userId: comments.userId })
    .from(comments)
    .where(eq(comments.id, input.commentId))
    .limit(1);
  if (!c) return { ok: false, error: "Comment not found." };

  if (c.userId === userId) {
    // Author: hard delete, no trace.
    await db.delete(comments).where(eq(comments.id, input.commentId));
  } else if (isAdmin(userId)) {
    // Admin: soft-delete so the slot is preserved in the thread.
    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, input.commentId));
  } else {
    return { ok: false, error: "Not allowed." };
  }

  revalidatePath(`/maps/${input.slug}`);
  return { ok: true };
}

/** Used by the map detail page server component. Hides body when
 * deletedAt is set; renders a placeholder upstream. */
export async function listCommentsForMap(slug: string) {
  const map = await db
    .select({ id: maps.id })
    .from(maps)
    .where(eq(maps.slug, slug))
    .limit(1);
  if (map.length === 0) return [] as Array<never>;

  const rows = await db
    .select({
      id: comments.id,
      reviewId: comments.reviewId,
      userId: comments.userId,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
    })
    .from(comments)
    .innerJoin(reviews, eq(reviews.id, comments.reviewId))
    .where(and(eq(reviews.mapId, map[0].id), isNull(reviews.deletedAt)))
    .orderBy(comments.reviewId, comments.createdAt);

  return rows;
}
