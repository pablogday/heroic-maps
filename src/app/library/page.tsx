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
import { mapCardCols, type MapCardData } from "@/lib/maps";
import { stagger } from "@/lib/stagger";
import { EmptyState } from "@/components/EmptyState";

export const metadata = {
  title: "Library — Heroic Maps",
  description: "Your favorites, bookmarks, and playthroughs.",
};

import {
  IconBookmark,
  IconFavorite,
  IconPlayed,
} from "@/components/nav-icons";

type Tab = "favorites" | "bookmarks" | "played";
const TABS: { value: Tab; label: string; Icon: () => React.ReactElement }[] = [
  { value: "favorites", label: "Favorites", Icon: IconFavorite },
  { value: "bookmarks", label: "Bookmarks", Icon: IconBookmark },
  { value: "played", label: "Played", Icon: IconPlayed },
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

// MapCard SELECT shape lives in lib/maps.ts as `mapCardCols`.

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
    .select({
      ...mapCardCols,
      bookmarked: userMaps.bookmarked,
      favorited: userMaps.favorited,
    })
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

  // LEFT JOIN userMaps so cards on the Played tab can still surface
  // the viewer's bookmark / favorite state. Without this the toggle
  // buttons render as "not set" even when the row is set, which leads
  // to a misleading click.
  const rows = await db
    .select({
      ...mapCardCols,
      bookmarked: sql<boolean>`COALESCE(${userMaps.bookmarked}, false)`,
      favorited: sql<boolean>`COALESCE(${userMaps.favorited}, false)`,
      lastOutcome: recencyByMap.lastOutcome,
      sessionCount: recencyByMap.sessionCount,
    })
    .from(recencyByMap)
    .innerJoin(maps, eq(recencyByMap.mapId, maps.id))
    .leftJoin(
      userMaps,
      and(eq(userMaps.mapId, maps.id), eq(userMaps.userId, userId))
    )
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

          {/* Tab nav: horizontal strip on desktop, stacked drawer
            * rows on mobile. Layout switches via CSS, but the
            * markup is one tree so we never double-render the
            * children below. */}
          <nav
            aria-label="Library tabs"
            className="mb-4 flex flex-col gap-2 md:mb-0 md:flex-row md:items-end md:gap-2 md:border-b md:border-brass/40"
          >
            {TABS.map((t) => {
              const active = t.value === activeTab;
              return (
                <Link
                  key={t.value}
                  href={`/library?tab=${t.value}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    // Mobile: drawer-row look — full-width pill with
                    // border + chevron. Active gets brass treatment.
                    "flex items-center gap-3 rounded border px-4 py-3 transition-colors",
                    active
                      ? "border-brass bg-parchment-dark/40 text-ink md:bg-parchment"
                      : "border-brass/30 text-ink-soft hover:bg-brass/10 hover:text-ink",
                    // Desktop overrides: collapse the border into a
                    // bottom-tab look, lose the row chevron, sit in a
                    // strip below the heading.
                    "md:-mb-px md:rounded-t md:rounded-b-none md:border-b-0 md:py-2",
                    active ? "md:border-brass" : "md:border-transparent",
                  ].join(" ")}
                >
                  <span className={active ? "text-brass" : "text-ink-soft"}>
                    <t.Icon />
                  </span>
                  <span className="flex-1 font-display text-base md:text-sm">
                    {t.label}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {counts[t.value]}
                  </span>
                  {/* Mobile-only chevron — orients the row as a
                    * tappable drawer. Hidden on desktop where the
                    * active-tab style is enough. */}
                  <span
                    aria-hidden
                    className={`text-ink-soft transition-transform md:hidden ${
                      active ? "rotate-90" : ""
                    }`}
                  >
                    ›
                  </span>
                </Link>
              );
            })}
            {/* Sort strip — pinned to the right of the desktop tab row,
              * stacks below the drawer rows on mobile. */}
            <div className="md:ml-auto md:mb-2">
              <SortStrip activeTab={activeTab} sort={sort} />
            </div>
          </nav>

          {/* Single content render — no double DOM, no double image
            * preload. CSS above swaps how the nav looks; this stays
            * the same in both layouts. */}
          <div className="mt-6">{children}</div>
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
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
        icon={<IconFavorite size={42} />}
        title="No treasures favored yet"
        body="Tap the heart on any map to keep it close at hand."
        cta={{ href: "/maps", label: "Browse maps" }}
      />
    );
  }
  if (tab === "bookmarks") {
    return (
      <EmptyState
        icon={<IconBookmark size={42} />}
        title="The shelves stand empty"
        body="Mark a scroll for later and it will wait for your return here."
        cta={{ href: "/maps", label: "Browse maps" }}
      />
    );
  }
  return (
    <EmptyState
      icon={<IconPlayed size={42} />}
      title="No conquests logged"
      body="Open a map and hit Played to begin your chronicle."
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
