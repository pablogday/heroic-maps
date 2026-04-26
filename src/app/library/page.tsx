import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { maps, userMaps } from "@/db/schema";
import { signInDiscord } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import type { MapCardData } from "@/lib/maps";

export const metadata = {
  title: "Library — Heroic Maps",
  description: "Your favorites, bookmarks, and playthroughs.",
};

type Tab = "favorites" | "bookmarks" | "played";
const TABS: { value: Tab; label: string; emoji: string }[] = [
  { value: "favorites", label: "Favorites", emoji: "♥" },
  { value: "bookmarks", label: "Bookmarks", emoji: "🔖" },
  { value: "played", label: "Played", emoji: "⚔" },
];

const OUTCOME_LABEL = { won: "Won", lost: "Lost", abandoned: "Abandoned" };
const OUTCOME_COLOR = {
  won: "text-emerald",
  lost: "text-blood",
  abandoned: "text-ink-soft",
};

type SP = Promise<{ tab?: string }>;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <SignedOut />;
  }

  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "bookmarks" || sp.tab === "played" ? sp.tab : "favorites";

  const where =
    tab === "favorites"
      ? and(eq(userMaps.userId, userId), eq(userMaps.favorited, true))
      : tab === "bookmarks"
        ? and(eq(userMaps.userId, userId), eq(userMaps.bookmarked, true))
        : and(eq(userMaps.userId, userId), isNotNull(userMaps.playedAt));

  const orderBy =
    tab === "played" ? desc(userMaps.playedAt) : desc(userMaps.updatedAt);

  // Same shape as MapCardData so we can hand rows straight to <MapCard>.
  const rows = await db
    .select({
      id: maps.id,
      slug: maps.slug,
      name: maps.name,
      description: maps.description,
      version: maps.version,
      size: maps.size,
      humanPlayers: maps.humanPlayers,
      totalPlayers: maps.totalPlayers,
      ratingSum: maps.ratingSum,
      ratingCount: maps.ratingCount,
      previewKey: maps.previewKey,
      hasUnderground: maps.hasUnderground,
      factions: maps.factions,
      downloadCount: maps.downloadCount,
      bookmarked: userMaps.bookmarked,
      playedOutcome: userMaps.playedOutcome,
    })
    .from(userMaps)
    .innerJoin(maps, eq(userMaps.mapId, maps.id))
    .where(where)
    .orderBy(orderBy)
    .limit(60);

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
       <PageReveal>
        <div className="mb-6">
          <h1 className="font-display text-4xl text-ink">Your Library</h1>
          <p className="mt-2 text-ink-soft">
            Maps you&apos;ve marked, saved, or played.
          </p>
        </div>

        <nav
          className="mb-6 flex gap-2 border-b border-brass/40"
          aria-label="Library tabs"
        >
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Link
                key={t.value}
                href={`/library?tab=${t.value}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px rounded-t border border-b-0 px-4 py-2 text-sm font-display transition-colors ${
                  active
                    ? "border-brass bg-parchment text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <span className="mr-1.5">{t.emoji}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <p className="text-center text-ink-soft py-16">
            {tab === "favorites" && "No favorites yet — tap ♥ on any map."}
            {tab === "bookmarks" && "No bookmarks yet — save maps to play later."}
            {tab === "played" && "No playthroughs logged yet."}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <MapCard
                key={r.id}
                map={r as MapCardData}
                signedIn={true}
                badge={
                  tab === "played" && r.playedOutcome ? (
                    <span
                      className={
                        OUTCOME_COLOR[
                          r.playedOutcome as keyof typeof OUTCOME_COLOR
                        ]
                      }
                    >
                      ⚔{" "}
                      {
                        OUTCOME_LABEL[
                          r.playedOutcome as keyof typeof OUTCOME_LABEL
                        ]
                      }
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
       </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function SignedOut() {
  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-12">
        <div className="card-brass max-w-md rounded p-8 text-center">
          <h1 className="font-display text-2xl text-ink">Your Library</h1>
          <p className="mt-3 text-ink-soft">
            Sign in to track favorites, bookmarks, and the maps you&apos;ve
            played.
          </p>
          <form action={signInDiscord} className="mt-5">
            <button
              type="submit"
              className="btn-brass rounded px-5 py-2 text-sm font-display"
            >
              Sign in with Discord
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
