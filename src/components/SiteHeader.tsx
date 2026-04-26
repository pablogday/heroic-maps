import Link from "next/link";
import { HeroicMark } from "./HeroicMark";
import { UserMenu } from "./UserMenu";
import { auth } from "@/auth";
import { signInDiscord } from "@/app/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-brass/40 bg-night-deep text-parchment">
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

        {user ? (
          <UserMenu name={user.name} image={user.image} />
        ) : (
          <form action={signInDiscord}>
            <button
              type="submit"
              className="btn-brass rounded px-4 py-1.5 text-sm font-display"
            >
              Sign in with Discord
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
