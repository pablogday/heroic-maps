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
import { EmptyState } from "@/components/EmptyState";

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
  isCampaign: sql<boolean>`(${maps.campaignData} IS NOT NULL)`,
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

  // Cheap counts for the mobile drawer headers + desktop tab badges.
  // All three run in parallel; each is a single index scan.
  const counts = await getLibraryCounts(userId);

  if (tab === "played") {
    return (
      <PlayedTab userId={userId} activeTab={tab} sort={sort} counts={counts} />
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
    <Shell activeTab={tab} sort={sort} counts={counts}>
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

interface LibraryCounts {
  favorites: number;
  bookmarks: number;
  played: number;
}

async function getLibraryCounts(userId: string): Promise<LibraryCounts> {
  const [favBook] = await db
    .select({
      favorites: sql<number>`count(*) FILTER (WHERE ${userMaps.favorited})::int`,
      bookmarks: sql<number>`count(*) FILTER (WHERE ${userMaps.bookmarked})::int`,
    })
    .from(userMaps)
    .where(eq(userMaps.userId, userId));

  const [played] = await db
    .select({
      n: sql<number>`count(DISTINCT ${playSessions.mapId})::int`,
    })
    .from(playSessions)
    .where(eq(playSessions.userId, userId));

  return {
    favorites: favBook?.favorites ?? 0,
    bookmarks: favBook?.bookmarks ?? 0,
    played: played?.n ?? 0,
  };
}

async function PlayedTab({
  userId,
  activeTab,
  sort,
  counts,
}: {
  userId: string;
  activeTab: Tab;
  sort: Sort;
  counts: LibraryCounts;
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
    <Shell activeTab={activeTab} sort={sort} counts={counts}>
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
  counts,
  children,
}: {
  activeTab: Tab;
  sort: Sort;
  counts: LibraryCounts;
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

          {/* Desktop: horizontal tabs above the grid. */}
          <div className="mb-6 hidden flex-wrap items-end justify-between gap-3 border-b border-brass/40 md:flex">
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
                    <span className="ml-1.5 text-xs text-ink-soft">
                      {counts[t.value]}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <SortStrip activeTab={activeTab} sort={sort} />
          </div>

          {/* Desktop: render content directly. */}
          <div className="hidden md:block">{children}</div>

          {/* Mobile: vertical drawers. Each section is its own row;
            * the active one expands to show its grid + sort options.
            * Inactive rows are <Link>s that navigate to that tab on
            * tap (server reload — keeps state in the URL). */}
          <div className="space-y-3 md:hidden">
            {TABS.map((t) => {
              const active = t.value === activeTab;
              return (
                <div
                  key={t.value}
                  className={`overflow-hidden rounded border ${
                    active
                      ? "border-brass bg-parchment-dark/30"
                      : "border-brass/30"
                  }`}
                >
                  <DrawerHeader
                    tab={t}
                    active={active}
                    count={counts[t.value]}
                  />
                  {active && (
                    <div className="border-t border-brass/30 px-3 py-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-xs text-ink-soft">Sort:</span>
                        <SortStrip
                          activeTab={activeTab}
                          sort={sort}
                          compact
                        />
                      </div>
                      {children}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Drawer header — clickable when collapsed (links to that tab),
 * static text when active. The chevron rotates to suggest open
 * state. */
function DrawerHeader({
  tab,
  active,
  count,
}: {
  tab: { value: Tab; label: string; emoji: string };
  active: boolean;
  count: number;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 text-left">
      <span className="text-lg" aria-hidden>
        {tab.emoji}
      </span>
      <span className="flex-1 font-display text-base text-ink">
        {tab.label}
      </span>
      <span className="text-xs text-ink-soft">{count}</span>
      <span
        aria-hidden
        className={`text-ink-soft transition-transform ${
          active ? "rotate-90" : ""
        }`}
      >
        ›
      </span>
    </div>
  );
  if (active) return <div>{inner}</div>;
  return (
    <Link
      href={`/library?tab=${tab.value}`}
      aria-label={`Open ${tab.label}`}
      className="block hover:bg-brass/10"
    >
      {inner}
    </Link>
  );
}

function SortStrip({
  activeTab,
  sort,
  compact = false,
}: {
  activeTab: Tab;
  sort: Sort;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        compact ? "" : "mb-2 text-sm"
      }`}
    >
      {!compact && <span className="text-xs text-ink-soft">Sort:</span>}
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
  );
}

function EmptyMessage({ tab }: { tab: Tab }) {
  if (tab === "favorites") {
    return (
      <EmptyState
        glyph="♥"
        title="No favorites yet"
        body="Tap the ♥ on any map to keep it close at hand."
        cta={{ href: "/maps", label: "Browse maps" }}
      />
    );
  }
  if (tab === "bookmarks") {
    return (
      <EmptyState
        glyph="🔖"
        title="No bookmarks yet"
        body="Save maps to play later — they'll show up here."
        cta={{ href: "/maps", label: "Browse maps" }}
      />
    );
  }
  return (
    <EmptyState
      glyph="⚔"
      title="No playthroughs logged yet"
      body="Open a map's detail page and hit Played to start your journal."
      cta={{ href: "/maps", label: "Find a map to play" }}
    />
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
