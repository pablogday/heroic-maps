import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { RatingBadge } from "@/components/RatingBadge";
import { MapCard } from "@/components/MapCard";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Filters } from "./Filters";
import { SmartSearchBar } from "./SmartSearchBar";
import {
  DIFFICULTIES,
  listMaps,
  SIZE_LABEL,
  SIZES,
  SORT_OPTIONS,
  VERSIONS,
  type Difficulty,
  type Size,
  type Sort,
  type Version,
} from "@/lib/maps";
import { versionLabel } from "@/lib/map-constants";
import { minDelay } from "@/lib/min-delay";
import { stagger } from "@/lib/stagger";
import { FACTIONS, type Faction } from "@/lib/factions";

type SP = Promise<{
  q?: string;
  version?: string;
  size?: string;
  players?: string;
  faction?: string;
  difficulty?: string;
  sort?: string;
  page?: string;
  view?: string;
  nlError?: string;
}>;

const isVersion = (v?: string): v is Version =>
  !!v && (VERSIONS as readonly string[]).includes(v);
const isSize = (v?: string): v is Size =>
  !!v && (SIZES as readonly string[]).includes(v);
const isFaction = (v?: string): v is Faction =>
  !!v && (FACTIONS as readonly string[]).includes(v);
const isDifficulty = (v?: string): v is Difficulty =>
  !!v && (DIFFICULTIES as readonly string[]).includes(v);
const isSort = (v?: string): v is Sort =>
  !!v && SORT_OPTIONS.some((o) => o.value === v);

export default async function MapsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim() || undefined,
    version: isVersion(sp.version) ? sp.version : undefined,
    size: isSize(sp.size) ? sp.size : undefined,
    players: sp.players ? Number(sp.players) || undefined : undefined,
    faction: isFaction(sp.faction) ? sp.faction : undefined,
    difficulty: isDifficulty(sp.difficulty) ? sp.difficulty : undefined,
    sort: isSort(sp.sort) ? sp.sort : ("downloads" as const),
    page: sp.page ? Number(sp.page) || 1 : 1,
  };
  const view: "grid" | "list" = sp.view === "list" ? "list" : "grid";

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const signedIn = viewerId != null;

  const { items, page, pageSize, total } = await minDelay(
    listMaps(filters, viewerId),
    500
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Partial<typeof filters>) => {
    const next = { ...filters, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.version) params.set("version", next.version);
    if (next.size) params.set("size", next.size);
    if (next.players) params.set("players", String(next.players));
    if (next.faction) params.set("faction", next.faction);
    if (next.difficulty) params.set("difficulty", next.difficulty);
    if (next.sort && next.sort !== "downloads")
      params.set("sort", next.sort);
    if (next.page && next.page !== 1) params.set("page", String(next.page));
    const qs = params.toString();
    return qs ? `/maps?${qs}` : "/maps";
  };

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
       <PageReveal>
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="font-display text-3xl text-ink">Browse maps</h1>
          <span className="text-sm text-ink-soft">
            {total.toLocaleString()} maps
          </span>
        </div>

        <SmartSearchBar initialError={sp.nlError} />
        <Filters />

        {items.length === 0 ? (
          <p className="text-center text-ink-soft py-12">
            No maps match your filters.
          </p>
        ) : view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m, i) => (
              <MapCard
                key={m.id}
                map={m}
                signedIn={signedIn}
                {...stagger(i)}
              />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((m, i) => (
              <li
                key={m.id}
                className="animate-card-rise"
                style={stagger(i).style}
              >
                <div className="card-brass flex flex-col gap-3 rounded p-3 sm:flex-row sm:gap-4">
                  <div className="flex gap-3 sm:contents">
                    {m.previewKey ? (
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-night-deep">
                        <Image
                          src={m.previewKey}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover pixelated"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-20 flex-shrink-0 rounded bg-night-deep" />
                    )}
                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-base text-ink truncate">
                          {m.name}
                        </h3>
                        <span
                          className="text-xs text-ink-soft flex-shrink-0"
                          title={m.version}
                        >
                          {versionLabel(m.version)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
                        {m.description ?? "No description provided."}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                        <span>{SIZE_LABEL[m.size as Size]}</span>
                        <span>·</span>
                        <span>
                          {m.humanPlayers}–{m.totalPlayers} players
                        </span>
                        <span>·</span>
                        <span>↓ {m.downloadCount.toLocaleString()}</span>
                        <span>·</span>
                        <RatingBadge
                          ratingSum={m.ratingSum}
                          ratingCount={m.ratingCount}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center justify-end gap-2 sm:self-center">
                    <a
                      href={`/api/maps/${m.id}/download`}
                      title="Download map"
                      aria-label={`Download ${m.name}`}
                      className="hidden h-9 w-9 items-center justify-center rounded border border-brass/50 text-ink-soft hover:bg-brass/20 hover:text-ink transition-colors sm:inline-flex"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                        <path d="M8 1a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V1.75A.75.75 0 0 1 8 1Z" />
                        <path d="M2.75 12a.75.75 0 0 1 .75.75v.75a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75v-.75a.75.75 0 0 1 1.5 0v.75A2.25 2.25 0 0 1 11.75 15.75h-7.5A2.25 2.25 0 0 1 2 13.5v-.75A.75.75 0 0 1 2.75 12Z" />
                      </svg>
                    </a>
                    <BookmarkButton
                      mapId={m.id}
                      slug={m.slug}
                      initial={m.bookmarked}
                      signedIn={signedIn}
                    />
                    <Link
                      href={`/maps/${m.slug}`}
                      className="rounded border border-brass/50 px-3 py-1.5 text-sm text-ink hover:bg-brass/20 transition-colors"
                    >
                      View map
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <Link
                href={buildHref({ page: page - 1 })}
                className="rounded border border-brass/50 px-3 py-1 hover:bg-brass/20"
              >
                ← Prev
              </Link>
            )}
            <span className="text-ink-soft">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildHref({ page: page + 1 })}
                className="rounded border border-brass/50 px-3 py-1 hover:bg-brass/20"
              >
                Next →
              </Link>
            )}
          </nav>
        )}
       </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}
