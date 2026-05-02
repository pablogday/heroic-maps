"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userMaps } from "@/db/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

async function setFlag(
  userId: string,
  mapId: number,
  flag: "favorited" | "bookmarked",
  value: boolean
) {
  await db
    .insert(userMaps)
    .values({
      userId,
      mapId,
      favorited: flag === "favorited" ? value : false,
      bookmarked: flag === "bookmarked" ? value : false,
    })
    .onConflictDoUpdate({
      target: [userMaps.userId, userMaps.mapId],
      set: {
        [flag]: value,
        updatedAt: new Date(),
      },
    });

  // Garbage-collect rows where neither flag is set. Played sessions
  // live in `play_sessions` now, so this row carries no state.
  await db
    .delete(userMaps)
    .where(
      and(
        eq(userMaps.userId, userId),
        eq(userMaps.mapId, mapId),
        eq(userMaps.favorited, false),
        eq(userMaps.bookmarked, false)
      )
    );
}

export async function toggleFavorite(
  mapId: number,
  slug: string,
  next: boolean
): Promise<ActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };
  await setFlag(userId, mapId, "favorited", next);
  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}

export async function toggleBookmark(
  mapId: number,
  slug: string,
  next: boolean
): Promise<ActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };
  await setFlag(userId, mapId, "bookmarked", next);
  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}
