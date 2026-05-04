"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userMaps } from "@/db/schema";
import { requireUserId } from "@/lib/auth-helpers";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Set or clear the bookmarked flag for a (user, map) pair. Replaces
 * the previous toggleFavorite + toggleBookmark pair after the Path-1
 * collapse — see migration 0011 for context.
 *
 * The user_maps row is garbage-collected when bookmarked drops to
 * false (the row carries no other state — playthroughs live in
 * play_sessions).
 */
export async function toggleBookmark(
  mapId: number,
  slug: string,
  next: boolean
): Promise<ActionResult> {
  const r = await requireUserId();
  if (!r.ok) return r;
  const userId = r.userId;

  if (next) {
    await db
      .insert(userMaps)
      .values({ userId, mapId, bookmarked: true })
      .onConflictDoUpdate({
        target: [userMaps.userId, userMaps.mapId],
        set: { bookmarked: true, updatedAt: new Date() },
      });
  } else {
    await db
      .delete(userMaps)
      .where(and(eq(userMaps.userId, userId), eq(userMaps.mapId, mapId)));
  }

  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}
