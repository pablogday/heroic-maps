"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { reviews, reviewReactions, maps } from "@/db/schema";

const MIN_BODY = 0; // body is optional
const MAX_BODY = 4000;
const RATE_LIMIT_WINDOW_SECONDS = 60;

type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitReview(
  mapId: number,
  rating: number,
  body: string,
  slug: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be 1–5." };
  }
  const trimmed = (body ?? "").trim();
  if (trimmed.length > MAX_BODY) {
    return { ok: false, error: `Review body too long (max ${MAX_BODY}).` };
  }
  if (trimmed.length < MIN_BODY) {
    return { ok: false, error: "Review too short." };
  }

  // Rate limit: don't allow > 1 NEW review per minute per user.
  // Edits to the user's existing review on this map are exempt
  // (one-row-per-user uniqueness already prevents spam there).
  const [existingForMap] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.mapId, mapId),
        eq(reviews.userId, session.user.id)
      )
    )
    .limit(1);
  if (!existingForMap) {
    const [recent] = await db
      .select({ createdAt: reviews.createdAt })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, session.user.id),
          sql`${reviews.createdAt} > now() - interval '${sql.raw(
            String(RATE_LIMIT_WINDOW_SECONDS)
          )} seconds'`
        )
      )
      .orderBy(sql`${reviews.createdAt} desc`)
      .limit(1);
    if (recent) {
      const elapsed = Math.floor(
        (Date.now() - new Date(recent.createdAt).getTime()) / 1000
      );
      const wait = Math.max(1, RATE_LIMIT_WINDOW_SECONDS - elapsed);
      return {
        ok: false,
        error: `Slow down — you can post another review in ${wait}s.`,
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(reviews)
      .values({
        mapId,
        userId: session.user!.id,
        rating,
        body: trimmed || null,
      })
      .onConflictDoUpdate({
        target: [reviews.mapId, reviews.userId],
        set: { rating, body: trimmed || null },
      });

    // Recompute aggregate from the source of truth.
    const [agg] = await tx
      .select({
        sum: sql<number>`coalesce(sum(${reviews.rating}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.mapId, mapId));

    await tx
      .update(maps)
      .set({ ratingSum: agg.sum, ratingCount: agg.count })
      .where(eq(maps.id, mapId));
  });

  revalidatePath(`/maps/${slug}`);
  return { ok: true };
}

/**
 * Toggle the current user's "this helped" reaction on a review.
 * Returns the new helpful count + whether the user is currently reacting.
 */
export async function toggleReviewHelpful(
  reviewId: number,
  slug: string
): Promise<
  | { ok: true; helpfulCount: number; reacting: boolean }
  | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in required." };

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ reviewId: reviewReactions.reviewId })
      .from(reviewReactions)
      .where(
        and(
          eq(reviewReactions.reviewId, reviewId),
          eq(reviewReactions.userId, userId)
        )
      )
      .limit(1);

    let reacting: boolean;
    if (existing) {
      await tx
        .delete(reviewReactions)
        .where(
          and(
            eq(reviewReactions.reviewId, reviewId),
            eq(reviewReactions.userId, userId)
          )
        );
      reacting = false;
    } else {
      await tx.insert(reviewReactions).values({ reviewId, userId });
      reacting = true;
    }

    const [agg] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(reviewReactions)
      .where(eq(reviewReactions.reviewId, reviewId));
    const helpfulCount = agg.n;

    await tx
      .update(reviews)
      .set({ helpfulCount })
      .where(eq(reviews.id, reviewId));

    return { helpfulCount, reacting };
  });

  revalidatePath(`/maps/${slug}`);
  return { ok: true, ...result };
}

export async function deleteReview(
  reviewId: number,
  mapId: number,
  slug: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(reviews)
      .where(
        and(eq(reviews.id, reviewId), eq(reviews.userId, session.user!.id))
      )
      .returning({ id: reviews.id });

    if (deleted.length === 0) return; // not yours; silently ignore

    const [agg] = await tx
      .select({
        sum: sql<number>`coalesce(sum(${reviews.rating}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.mapId, mapId));

    await tx
      .update(maps)
      .set({ ratingSum: agg.sum, ratingCount: agg.count })
      .where(eq(maps.id, mapId));
  });

  revalidatePath(`/maps/${slug}`);
  return { ok: true };
}
