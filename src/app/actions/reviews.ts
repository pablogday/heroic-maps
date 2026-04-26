"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { reviews, maps } from "@/db/schema";

const MIN_BODY = 0; // body is optional
const MAX_BODY = 4000;

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
