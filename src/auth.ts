import "server-only";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import {
  slugifyForUsername,
  isValidUsername,
} from "@/lib/reserved-usernames";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // AUTH_DISCORD_ID and AUTH_DISCORD_SECRET are auto-read from env.
  providers: [Discord],
  session: { strategy: "database" },
  callbacks: {
    // Mirror provider account id and avatar onto our domain columns.
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord" && user?.id) {
        const [existing] = await db
          .select({ username: users.username, name: users.name })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        const ensuredUsername =
          existing?.username ??
          (await ensureUsername(
            user.id,
            existing?.name ?? user.name ?? "hero"
          ));
        await db
          .update(users)
          .set({
            discordId: account.providerAccountId,
            avatarUrl:
              (profile as { image_url?: string } | undefined)?.image_url ??
              user.image ??
              null,
            username: ensuredUsername,
          })
          .where(eq(users.id, user.id));
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

/**
 * Generate a unique username from a display name. Tries the slug,
 * then `<slug>-2`, `-3`, etc. until one's free. Caps at 20 attempts
 * before falling back to a timestamp-suffixed handle.
 */
async function ensureUsername(
  userId: string,
  displayName: string
): Promise<string> {
  const base = slugifyForUsername(displayName) || "hero";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!isValidUsername(candidate)) continue;
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, candidate), ne(users.id, userId)))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 30);
}
