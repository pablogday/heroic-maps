import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { maps, userMaps, playSessions } from "@/db/schema";
import { signInDiscord } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import type { MapCardData } from "@/lib/maps";
import { stagger } from "@/lib/stagger";

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

type Sort = "recent" | "oldest" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
];

type SP = Promise<{ tab?: string; sort?: string }>;

function parseSort(s: string | undefined): Sort {
  return s === "oldest" || s === "name" ? s : "recent";
}

const cardCols = {
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
  undergroundPreviewKey: maps.undergroundPreviewKey,
  hasUnderground: maps.hasUnderground,
  factions: maps.factions,
  downloadCount: maps.downloadCount,
};

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
  const sort = parseSort(sp.sort);

  if (tab === "played") {
    return (
      <PlayedTab userId={userId} activeTab={tab} sort={sort} />
    );
  }

  const where =
    tab === "favorites"
      ? and(eq(userMaps.userId, userId), eq(userMaps.favorited, true))
      : and(eq(userMaps.userId, userId), eq(userMaps.bookmarked, true));

  const orderBy =
    sort === "oldest"
      ? asc(userMaps.updatedAt)
      : sort === "name"
        ? asc(maps.name)
        : desc(userMaps.updatedAt);

  const rows = await db
    .select({ ...cardCols, bookmarked: userMaps.bookmarked })
    .from(userMaps)
    .innerJoin(maps, eq(userMaps.mapId, maps.id))
    .where(where)
    .orderBy(orderBy)
    .limit(60);

  return (
    <Shell activeTab={tab} sort={sort}>
      {rows.length === 0 ? (
        <EmptyMessage tab={tab} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => (
            <MapCard
              key={r.id}
              map={r as MapCardData}
              signedIn={true}
              {...stagger(i)}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

async function PlayedTab({
  userId,
  activeTab,
  sort,
}: {
  userId: string;
  activeTab: Tab;
  sort: Sort;
}) {
  // One row per distinct (user, map) — most-recent session wins for the
  // "last played" sort and badge.
  const recencyByMap = db
    .select({
      mapId: playSessions.mapId,
      lastPlayed: sql<Date>`MAX(${playSessions.playedAt})`.as("last_played"),
      firstPlayed: sql<Date>`MIN(${playSessions.playedAt})`.as("first_played"),
      lastOutcome:
        sql<string>`(ARRAY_AGG(${playSessions.outcome} ORDER BY ${playSessions.playedAt} DESC))[1]`.as(
          "last_outcome"
        ),
      sessionCount: sql<number>`COUNT(*)::int`.as("session_count"),
    })
    .from(playSessions)
    .where(eq(playSessions.userId, userId))
    .groupBy(playSessions.mapId)
    .as("recent_sessions");

  const orderBy =
    sort === "oldest"
      ? asc(recencyByMap.firstPlayed)
      : sort === "name"
        ? asc(maps.name)
        : desc(recencyByMap.lastPlayed);

  const rows = await db
    .select({
      ...cardCols,
      bookmarked: sql<boolean>`false`.as("bookmarked"),
      lastOutcome: recencyByMap.lastOutcome,
      sessionCount: recencyByMap.sessionCount,
    })
    .from(recencyByMap)
    .innerJoin(maps, eq(recencyByMap.mapId, maps.id))
    .orderBy(orderBy)
    .limit(60);

  return (
    <Shell activeTab={activeTab} sort={sort}>
      {rows.length === 0 ? (
        <EmptyMessage tab={activeTab} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => (
            <MapCard
              key={r.id}
              map={r as MapCardData}
              signedIn={true}
              {...stagger(i)}
              badge={
                <span
                  className={
                    OUTCOME_COLOR[r.lastOutcome as keyof typeof OUTCOME_COLOR]
                  }
                >
                  ⚔{" "}
                  {OUTCOME_LABEL[r.lastOutcome as keyof typeof OUTCOME_LABEL]}
                  {r.sessionCount > 1 && ` · ${r.sessionCount}×`}
                </span>
              }
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({
  activeTab,
  sort,
  children,
}: {
  activeTab: Tab;
  sort: Sort;
  children: React.ReactNode;
}) {
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

          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-brass/40">
            <nav className="flex gap-2" aria-label="Library tabs">
              {TABS.map((t) => {
                const active = t.value === activeTab;
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
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-xs text-ink-soft">Sort:</span>
              {SORTS.map((s) => {
                const active = s.value === sort;
                return (
                  <Link
                    key={s.value}
                    href={`/library?tab=${activeTab}&sort=${s.value}`}
                    aria-current={active ? "true" : undefined}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      active
                        ? "border-brass bg-brass/15 text-ink"
                        : "border-brass/40 text-ink-soft hover:bg-brass/15 hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {children}
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function EmptyMessage({ tab }: { tab: Tab }) {
  return (
    <p className="text-center text-ink-soft py-16">
      {tab === "favorites" && "No favorites yet — tap ♥ on any map."}
      {tab === "bookmarks" && "No bookmarks yet — save maps to play later."}
      {tab === "played" && "No playthroughs logged yet."}
    </p>
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
