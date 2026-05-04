import { auth } from "@/auth";
import { isAdmin } from "./admin";

/**
 * Discriminated-union helpers for the auth boilerplate that every
 * server action started repeating. Each returns either a `userId`
 * payload (caller proceeds) or an `error` payload (caller returns
 * straight to the client). The error shape matches the existing
 * `ActionResult` convention used across the app.
 *
 * Usage:
 *   const r = await requireUserId();
 *   if (!r.ok) return r;
 *   // r.userId is non-null below
 *
 *   const r = await requireAdminId();
 *   if (!r.ok) return r;
 */
export type RequireResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Standard "must be signed in" gate. Reads the session, returns the
 * user id on success or a 401-style error otherwise. Override the
 * message at the call site when the action has a more specific
 * phrasing (e.g. "Sign in to comment").
 */
export async function requireUserId(
  message = "Sign in required."
): Promise<RequireResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: message };
  return { ok: true, userId };
}

/**
 * Same as `requireUserId` but additionally checks the env-driven
 * admin allow-list. Used by moderation actions and the /admin/* areas.
 */
export async function requireAdminId(
  message = "Not allowed."
): Promise<RequireResult> {
  const r = await requireUserId(message);
  if (!r.ok) return r;
  if (!isAdmin(r.userId)) return { ok: false, error: message };
  return r;
}
