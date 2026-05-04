/**
 * Admin allow-list. Read at request time from a comma-separated env
 * var so promotion is a Vercel/Neon redeploy and never a UI-driven
 * flag. Keep the list small (the project owner + maybe one trusted
 * helper) — anyone in here can soft-delete reviews/comments and view
 * the report queue.
 *
 *   ADMIN_USER_IDS="cuid_or_uuid_1,cuid_or_uuid_2"
 *
 * The IDs are `users.id` values, which are auth-issued strings (not
 * Discord IDs). Easiest way to look one up: sign in, open
 * /api/auth/session in another tab, copy `user.id`.
 */
const ADMINS = (() => {
  const raw = process.env.ADMIN_USER_IDS;
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
})();

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return ADMINS.has(userId);
}

export function adminCount(): number {
  return ADMINS.size;
}
