import Link from "next/link";
import { eq } from "drizzle-orm";
import { HeroicMark } from "./HeroicMark";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signInDiscord } from "@/app/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const [me] = user?.id
    ? await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
    : [undefined];
  const username = me?.username ?? null;

  return (
    // z-50 so the mobile drawer's backdrop doesn't dim the header — the
    // merged menu button needs to stay tappable while the drawer is open.
    <header className="relative z-50 border-b border-brass/40 bg-night-deep text-parchment">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <HeroicMark size={36} />
          <div className="font-display text-xl text-brass-bright leading-none">
            Heroic Maps
          </div>
        </Link>

        <nav className="hidden gap-6 text-sm font-medium text-parchment/80 md:flex">
          <Link className="hover:text-brass-bright" href="/maps">
            Browse
          </Link>
          <Link className="hover:text-brass-bright" href="/feed">
            Feed
          </Link>
          <Link className="hover:text-brass-bright" href="/stats">
            Stats
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            // Desktop avatar dropdown (md+ only).
            <UserMenu
              name={user.name}
              image={user.image}
              username={username}
            />
          ) : (
            // Desktop sign-in button (md+ only). Mobile signed-out users
            // sign in from inside the merged drawer instead.
            <form action={signInDiscord} className="hidden md:block">
              <button
                type="submit"
                className="btn-brass rounded px-4 py-1.5 text-sm font-display"
              >
                Sign in with Discord
              </button>
            </form>
          )}
          <MobileNav
            user={
              user
                ? { name: user.name, image: user.image, username }
                : null
            }
          />
        </div>
      </div>
    </header>
  );
}
