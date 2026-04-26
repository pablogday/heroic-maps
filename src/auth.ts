import "server-only";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

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
        await db
          .update(users)
          .set({
            discordId: account.providerAccountId,
            avatarUrl:
              (profile as { image_url?: string } | undefined)?.image_url ??
              user.image ??
              null,
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
