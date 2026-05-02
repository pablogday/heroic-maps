"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { FACTIONS } from "@/lib/factions";

export type PlayedOutcome = "won" | "lost" | "abandoned";
const OUTCOMES: readonly PlayedOutcome[] = ["won", "lost", "abandoned"];

const NOTES_MAX = 4000;
const DAYS_MAX = 9999;

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export interface PlaySessionInput {
  mapId: number;
  slug: string;
  faction: string | null;
  outcome: PlayedOutcome;
  durationDays: number | null;
  notes: string;
  isPublic: boolean;
  /** Optional override for when the playthrough happened. Defaults to now. */
  playedAt?: Date;
}

async function requireUser(): Promise<string | null> {
  const s = await auth();
  return s?.user?.id ?? null;
}

function validate(input: PlaySessionInput): string | null {
  if (!OUTCOMES.includes(input.outcome)) return "Invalid outcome.";
  if (
    input.faction !== null &&
    !FACTIONS.includes(input.faction as (typeof FACTIONS)[number])
  ) {
    return "Invalid faction.";
  }
  if (input.notes.length > NOTES_MAX) {
    return `Notes too long (max ${NOTES_MAX}).`;
  }
  if (input.durationDays !== null) {
    if (
      !Number.isInteger(input.durationDays) ||
      input.durationDays < 0 ||
      input.durationDays > DAYS_MAX
    ) {
      return "Duration must be 0–9999 days.";
    }
  }
  return null;
}

export async function logPlaySession(
  input: PlaySessionInput
): Promise<Result<{ id: number }>> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const [row] = await db
    .insert(playSessions)
    .values({
      userId,
      mapId: input.mapId,
      playedAt: input.playedAt ?? new Date(),
      faction: input.faction,
      outcome: input.outcome,
      durationDays: input.durationDays,
      notes: input.notes.trim() || null,
      isPublic: input.isPublic,
    })
    .returning({ id: playSessions.id });

  revalidatePath(`/maps/${input.slug}`);
  revalidatePath("/library");
  return { ok: true, data: { id: row.id } };
}

export async function updatePlaySession(
  sessionId: number,
  slug: string,
  patch: Partial<Omit<PlaySessionInput, "mapId" | "slug">>
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };

  const [existing] = await db
    .select()
    .from(playSessions)
    .where(eq(playSessions.id, sessionId))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return { ok: false, error: "Not found." };
  }

  // Validate the merged shape so partial updates can't sneak invalid
  // values past the checks.
  const merged: PlaySessionInput = {
    mapId: existing.mapId,
    slug,
    faction: patch.faction !== undefined ? patch.faction : existing.faction,
    outcome:
      patch.outcome !== undefined
        ? patch.outcome
        : (existing.outcome as PlayedOutcome),
    durationDays:
      patch.durationDays !== undefined
        ? patch.durationDays
        : existing.durationDays,
    notes: patch.notes !== undefined ? patch.notes : (existing.notes ?? ""),
    isPublic:
      patch.isPublic !== undefined ? patch.isPublic : existing.isPublic,
  };
  const err = validate(merged);
  if (err) return { ok: false, error: err };

  await db
    .update(playSessions)
    .set({
      faction: merged.faction,
      outcome: merged.outcome,
      durationDays: merged.durationDays,
      notes: merged.notes.trim() || null,
      isPublic: merged.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(playSessions.id, sessionId));

  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}

export async function deletePlaySession(
  sessionId: number,
  slug: string
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Sign in required." };

  await db
    .delete(playSessions)
    .where(
      and(eq(playSessions.id, sessionId), eq(playSessions.userId, userId))
    );

  revalidatePath(`/maps/${slug}`);
  revalidatePath("/library");
  return { ok: true };
}
