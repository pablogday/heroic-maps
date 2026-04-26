"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userMaps } from "@/db/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

export type PlayedOutcome = "won" | "lost" | "abandoned";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

/** Upsert a single boolean flag — `favorited` or `bookmarked`. */
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

  // Garbage-collect rows that no longer carry any state.
  await db
    .delete(userMaps)
    .where(
      and(
        eq(userMaps.userId, userId),
        eq(userMaps.mapId, mapId),
        eq(userMaps.favorited, false),
        eq(userMaps.bookmarked, false),
        sql`${userMaps.playedAt} IS NULL`
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

export async function setPlayed(
  mapId: number,
  slug: string,
  outcome: PlayedOutcome | null
): Promise<ActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };

  if (outcome == null) {
    // Clear the played status — keep the row only if other flags survive.
    await db
      .insert(userMaps)
      .values({ userId, mapId, playedAt: null, playedOutcome: null })
      .onConflictDoUpdate({
        target: [userMaps.userId, userMaps.mapId],
        set: { playedAt: null, playedOutcome: null, updatedAt: new Date() },
      });

    await db
      .delete(userMaps)
      .where(
        and(
          eq(userMaps.userId, userId),
          eq(userMaps.mapId, mapId),
          eq(userMaps.favorited, false),
          eq(userMaps.bookmarked, false),
          sql`${userMaps.playedAt} IS NULL`
        )
      );
  } else {
    await db
      .insert(userMaps)
      .values({
        userId,
        mapId,
        playedAt: new Date(),
        playedOutcome: outcome,
      })
      .onConflictDoUpdate({
        target: [userMaps.userId, userMaps.mapId],
        set: {
          playedAt: new Date(),
          playedOutcome: outcome,
          updatedAt: new Date(),
        },
      });
  }

  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}
