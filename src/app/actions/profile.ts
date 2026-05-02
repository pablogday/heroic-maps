"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isValidUsername } from "@/lib/reserved-usernames";

const BIO_MAX = 500;

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfile(
  username: string,
  bio: string
): Promise<Result> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in required." };

  const trimmedUsername = username.trim().toLowerCase();
  const trimmedBio = bio.trim();

  if (!isValidUsername(trimmedUsername)) {
    return {
      ok: false,
      error:
        "Username must be 2–30 chars, lowercase letters/numbers/_/- only, and not reserved.",
    };
  }
  if (trimmedBio.length > BIO_MAX) {
    return { ok: false, error: `Bio too long (max ${BIO_MAX}).` };
  }

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.username, trimmedUsername), ne(users.id, userId))
    )
    .limit(1);
  if (taken) return { ok: false, error: "That username's already taken." };

  await db
    .update(users)
    .set({ username: trimmedUsername, bio: trimmedBio || null })
    .where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath(`/${trimmedUsername}`);
  return { ok: true };
}
