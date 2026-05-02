import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { maps, reviews, users, playSessions, reviewReactions } from "@/db/schema";
import { getSeriesContext, getSimilarMaps } from "@/lib/maps";
import { versionLabel } from "@/lib/map-constants";
import { MapCard } from "@/components/MapCard";
import { SeriesBlock } from "@/components/SeriesBlock";
import { auth } from "@/auth";
import { signInDiscord } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatIcon, type IconName } from "@/components/StatIcon";
import { MapStats } from "@/components/MapStats";
import { MapThumbnail } from "@/components/MapThumbnail";
import { PageReveal } from "@/components/PageReveal";
import { FactionCrest } from "@/components/FactionCrest";
import { FACTION_LABEL, type Faction } from "@/lib/factions";
import { minDelay } from "@/lib/min-delay";
import { stagger } from "@/lib/stagger";
import { userMaps } from "@/db/schema";
import { ReviewForm } from "./ReviewForm";
import { PlayJournal } from "./PlayJournal";
import { PreviewLightboxTrigger } from "./PreviewLightboxTrigger";
import { HelpfulButton } from "./HelpfulButton";

function ObjectStatsCard({ stats }: { stats: Record<string, unknown> }) {
  const num = (k: string): number => {
    const v = stats[k];
    return typeof v === "number" ? v : 0;
  };
  const all: Array<[string, string, number]> = [
    ["towns", "Towns", num("towns")],
    ["heroes", "Heroes", num("heroes")],
    ["monsters", "Monsters", num("monsters")],
    ["mines", "Mines", num("mines")],
    ["dwellings", "Creature dwellings", num("dwellings")],
    ["resources", "Resources", num("resources")],
    ["artifacts", "Artifacts", num("artifacts")],
    ["treasures", "Treasures", num("treasures")],
    ["questPoints", "Quest objects", num("questPoints")],
    ["oneShotBoosts", "Bonus locations", num("oneShotBoosts")],
  ];
  const rows = all.filter((r) => r[2] > 0);

  if (rows.length === 0) return null;

  return (
    <div className="card-brass rounded p-5">
      <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
        Map contents
      </h3>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([key, label, n]) => (
          <div key={key} className="flex items-baseline justify-between gap-2">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-ink font-medium">{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-ink-soft/70">
        Counted from the map file by our parser.
      </p>
    </div>
  );
}

function topFaction(
  rows: Array<{ outcome: string; faction: string | null }>,
  outcome: "won" | "lost" | "abandoned"
): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.outcome !== outcome || !r.faction) continue;
    counts.set(r.faction, (counts.get(r.faction) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ reviewSort?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const [m] = await db
    .select({ name: maps.name, description: maps.description })
    .from(maps)
    .where(eq(maps.slug, slug))
    .limit(1);
  if (!m) return { title: "Map not found — Heroic Maps" };
  return {
    title: `${m.name} — Heroic Maps`,
    description: m.description?.slice(0, 160) ?? undefined,
  };
}

export default async function MapDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const reviewSort: "newest" | "helpful" =
    sp.reviewSort === "helpful" ? "helpful" : "newest";
  const { slug } = await params;
  const [m] = await minDelay(
    db.select().from(maps).where(eq(maps.slug, slug)).limit(1),
    500
  );

  if (!m) notFound();

  const avgRating = m.ratingCount > 0 ? m.ratingSum / m.ratingCount : null;

  // Reviews — current user's first (if any), then everyone else newest-first.
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const signedIn = viewerId != null;

  // Sibling lookups run in parallel — both index-friendly queries.
  const [similar, seriesCtx] = await Promise.all([
    getSimilarMaps(
      {
        id: m.id,
        version: m.version,
        size: m.size,
        totalPlayers: m.totalPlayers,
        hasUnderground: m.hasUnderground,
        factions: m.factions,
        seriesId: m.seriesId,
        difficulty: m.difficulty,
      },
      6,
      viewerId
    ),
    getSeriesContext(m.id),
  ]);

  // Library state (favorite/bookmark) for this user/map.
  const [libRow] = viewerId
    ? await db
        .select({
          favorited: userMaps.favorited,
          bookmarked: userMaps.bookmarked,
        })
        .from(userMaps)
        .where(and(eq(userMaps.userId, viewerId), eq(userMaps.mapId, m.id)))
        .limit(1)
    : [undefined];
  const libState = {
    favorited: libRow?.favorited ?? false,
    bookmarked: libRow?.bookmarked ?? false,
  };

  // Viewer's play sessions for this map.
  const mySessions = viewerId
    ? await db
        .select({
          id: playSessions.id,
          playedAt: playSessions.playedAt,
          faction: playSessions.faction,
          outcome: playSessions.outcome,
          durationDays: playSessions.durationDays,
          notes: playSessions.notes,
          isPublic: playSessions.isPublic,
        })
        .from(playSessions)
        .where(
          and(
            eq(playSessions.userId, viewerId),
            eq(playSessions.mapId, m.id)
          )
        )
        .orderBy(desc(playSessions.playedAt))
    : [];

  // Aggregate stats across all public sessions on this map.
  const allSessions = await db
    .select({
      outcome: playSessions.outcome,
      faction: playSessions.faction,
    })
    .from(playSessions)
    .where(
      and(eq(playSessions.mapId, m.id), eq(playSessions.isPublic, true))
    );
  const sessionStats = {
    total: allSessions.length,
    won: allSessions.filter((s) => s.outcome === "won").length,
    lost: allSessions.filter((s) => s.outcome === "lost").length,
    abandoned: allSessions.filter((s) => s.outcome === "abandoned").length,
    topWinningFaction: topFaction(allSessions, "won"),
  };

  const [myReview] = viewerId
    ? await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          body: reviews.body,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(and(eq(reviews.mapId, m.id), eq(reviews.userId, viewerId)))
        .limit(1)
    : [undefined];

  const otherReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
      helpfulCount: reviews.helpfulCount,
      authorName: users.name,
      authorImage: users.image,
      authorUsername: users.username,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(
      viewerId
        ? and(eq(reviews.mapId, m.id), ne(reviews.userId, viewerId))
        : eq(reviews.mapId, m.id)
    )
    .orderBy(
      reviewSort === "helpful"
        ? desc(reviews.helpfulCount)
        : desc(reviews.createdAt),
      desc(reviews.createdAt)
    )
    .limit(50);

  // Which of these reviews has the viewer reacted to?
  const myReactionIds = new Set<number>();
  if (viewerId && otherReviews.length > 0) {
    const ids = otherReviews.map((r) => r.id);
    const rows = await db
      .select({ reviewId: reviewReactions.reviewId })
      .from(reviewReactions)
      .where(
        and(
          eq(reviewReactions.userId, viewerId),
          sql`${reviewReactions.reviewId} = ANY(${ids})`
        )
      );
    for (const row of rows) myReactionIds.add(row.reviewId);
  }

  // JSON-LD structured data — Google uses this for rich snippets
  // (rating stars, review counts, image preview).
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://heroic-maps.vercel.app";
  const avgRatingForLd =
    m.ratingCount > 0 ? m.ratingSum / m.ratingCount : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: m.name,
    description: m.description ?? undefined,
    url: `${siteUrl}/maps/${m.slug}`,
    image: m.previewKey ?? undefined,
    genre: "Heroes of Might and Magic 3 map",
    datePublished: m.publishedAt
      ? new Date(m.publishedAt).toISOString()
      : undefined,
    inLanguage: "en",
    author: m.author ? { "@type": "Person", name: m.author } : undefined,
    aggregateRating:
      avgRatingForLd !== null
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(avgRatingForLd.toFixed(2)),
            ratingCount: m.ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "https://schema.org/DownloadAction" },
      userInteractionCount: m.downloadCount,
    },
  };

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
       <PageReveal>
        <Link
          href="/maps"
          className="mb-4 inline-block text-sm text-blood hover:underline"
        >
          ← Back to browse
        </Link>

        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-4xl text-ink">{m.name}</h1>
            {m.author && (
              <p className="mt-1 text-sm text-ink-soft">
                by <span className="text-ink">{m.author}</span>
              </p>
            )}
          </div>
          <span className="text-sm text-ink-soft">
            {versionLabel(m.version)}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            {m.previewKey ? (
              <>
                {/* Mobile: single thumbnail with surface/underground toggle */}
                <div className="card-brass overflow-hidden rounded sm:hidden">
                  <MapThumbnail
                    previewKey={m.previewKey}
                    undergroundPreviewKey={m.undergroundPreviewKey}
                    name={m.name}
                    hasUnderground={m.hasUnderground}
                    sizes="100vw"
                    priority
                    className="object-contain pixelated"
                  />
                </div>

                {/* Tablet/desktop: side-by-side, click to zoom */}
                <PreviewLightboxTrigger
                  mapName={m.name}
                  surfaceUrl={m.previewKey}
                  undergroundUrl={
                    m.hasUnderground
                      ? m.undergroundPreviewKey ??
                        m.previewKey.replace("/img/", "/img_und/")
                      : null
                  }
                />
              </>
            ) : (
              <div className="card-brass aspect-square flex items-center justify-center rounded text-ink-soft">
                No preview
              </div>
            )}

            <section className="card-brass mt-4 rounded p-5">
              <h2 className="font-display text-lg text-ink mb-2">About</h2>
              <p className="whitespace-pre-line text-sm text-ink-soft leading-relaxed">
                {m.description ?? "No description provided."}
              </p>
            </section>

            <section className="card-brass mt-4 rounded p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg text-ink">Reviews</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">
                    {avgRating != null
                      ? `★ ${avgRating.toFixed(1)} · ${m.ratingCount} rating${m.ratingCount === 1 ? "" : "s"}`
                      : "No ratings yet"}
                  </span>
                  {otherReviews.length > 1 && (
                    <div className="inline-flex overflow-hidden rounded border border-brass/40 text-xs">
                      <Link
                        href={`/maps/${m.slug}`}
                        scroll={false}
                        className={`px-2 py-0.5 transition-colors ${
                          reviewSort === "newest"
                            ? "bg-brass/20 text-ink"
                            : "text-ink-soft hover:bg-brass/15"
                        }`}
                      >
                        Newest
                      </Link>
                      <Link
                        href={`/maps/${m.slug}?reviewSort=helpful`}
                        scroll={false}
                        className={`px-2 py-0.5 transition-colors ${
                          reviewSort === "helpful"
                            ? "bg-brass/20 text-ink"
                            : "text-ink-soft hover:bg-brass/15"
                        }`}
                      >
                        Most helpful
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* AI summary */}
              {m.aiSummary && (
                <div className="mb-5 rounded border border-brass/40 bg-night-deep/40 p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-brass">
                    <span aria-hidden>✦</span>
                    <span>AI summary</span>
                    <span className="text-ink-soft/70 normal-case tracking-normal">
                      · based on {m.aiSummaryReviewCount} review
                      {m.aiSummaryReviewCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-sm text-parchment/90 leading-relaxed">
                    {m.aiSummary}
                  </p>
                </div>
              )}

              {/* Compose / edit own review */}
              {viewerId ? (
                <div className="mb-5 rounded border border-brass/30 bg-parchment-dark/30 p-4">
                  <div className="mb-2 text-xs uppercase tracking-wider text-ink-soft">
                    {myReview ? "Your review" : "Leave a review"}
                  </div>
                  <ReviewForm
                    mapId={m.id}
                    slug={m.slug}
                    initialRating={myReview?.rating}
                    initialBody={myReview?.body}
                    reviewId={myReview?.id}
                  />
                </div>
              ) : (
                <div className="mb-5 flex items-center justify-between rounded border border-brass/30 bg-parchment-dark/30 p-4">
                  <p className="text-sm text-ink-soft">
                    Sign in to rate this map.
                  </p>
                  <form action={signInDiscord}>
                    <button
                      type="submit"
                      className="btn-brass rounded px-3 py-1.5 text-xs font-display"
                    >
                      Sign in
                    </button>
                  </form>
                </div>
              )}

              {/* Existing reviews */}
              {otherReviews.length === 0 && !myReview ? (
                <p className="text-sm text-ink-soft">
                  No reviews yet. Be the first to share your take.
                </p>
              ) : (
                <ul className="space-y-4">
                  {otherReviews.map((r) => (
                    <li
                      key={r.id}
                      className="border-b border-brass/20 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        {r.authorImage ? (
                          <Image
                            src={r.authorImage}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full border border-brass/40"
                            unoptimized
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-brass/30" />
                        )}
                        {r.authorUsername ? (
                          <Link
                            href={`/${r.authorUsername}`}
                            className="text-sm font-medium text-ink hover:text-blood"
                          >
                            {r.authorName ?? "Anonymous"}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-ink">
                            {r.authorName ?? "Anonymous"}
                          </span>
                        )}
                        <span className="text-xs text-brass">
                          {"★".repeat(r.rating)}
                          <span className="text-ink-soft/30">
                            {"★".repeat(5 - r.rating)}
                          </span>
                        </span>
                        <span className="ml-auto text-xs text-ink-soft">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {r.body && (
                        <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
                          {r.body}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <HelpfulButton
                          reviewId={r.id}
                          slug={m.slug}
                          initialCount={r.helpfulCount}
                          initialReacting={myReactionIds.has(r.id)}
                          signedIn={!!viewerId}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card-brass rounded p-5">
              {/* Desktop only: download CTA. HoMM3 is PC-only, so no point on mobile. */}
              <a
                href={`/api/maps/${m.id}/download`}
                className="btn-brass hidden rounded px-4 py-3 text-center text-sm font-display sm:block"
              >
                Download
              </a>
              {/* Mobile only: explain why there's no download button. */}
              <div className="rounded border border-brass/40 bg-night-deep/30 p-3 text-center text-xs text-ink-soft sm:hidden">
                <span className="mr-1" aria-hidden>🖥</span>
                Visit on desktop to download. HoMM3 maps run on PC only.
              </div>

              {viewerId ? (
                <div className="mt-4">
                  <PlayJournal
                    mapId={m.id}
                    slug={m.slug}
                    signedIn={true}
                    initial={mySessions.map((s) => ({
                      ...s,
                      outcome: s.outcome as "won" | "lost" | "abandoned",
                    }))}
                    mapFactions={m.factions ?? null}
                    initialLibrary={libState}
                  />
                </div>
              ) : (
                <p className="mt-4 text-center text-[11px] text-ink-soft">
                  Sign in to favorite, bookmark, or log a playthrough.
                </p>
              )}
              <dl className="mt-4 space-y-1.5 text-sm">
                <Stat
                  icon="downloads"
                  label="Downloads"
                  value={m.downloadCount.toLocaleString()}
                />
                <Stat
                  icon="rating"
                  label="Rating"
                  value={
                    avgRating != null
                      ? `${avgRating.toFixed(1)} (${m.ratingCount})`
                      : "no reviews yet"
                  }
                />
                {m.sourceRating != null && (
                  <div
                    className="flex items-center justify-between gap-2"
                    title="Popularity score imported from maps4heroes.com — scale is unknown, treat as a rough proxy."
                  >
                    <dt className="flex items-center gap-2 text-ink-soft">
                      <StatIcon name="rating" />
                      maps4heroes score
                    </dt>
                    <dd className="text-ink font-medium">
                      {Math.round(m.sourceRating)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <MapStats
              size={m.size}
              difficulty={m.difficulty}
              totalPlayers={m.totalPlayers}
              humanPlayers={m.humanPlayers}
              aiPlayers={m.aiPlayers}
              teamCount={m.teamCount}
              hasUnderground={m.hasUnderground}
            />

            {sessionStats.total > 0 && (
              <div className="card-brass rounded p-5">
                <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
                  Playthroughs
                </h3>
                <p className="text-sm text-ink">
                  <span className="font-medium">{sessionStats.total}</span>{" "}
                  logged ·{" "}
                  <span className="text-emerald">{sessionStats.won} won</span>
                  {" · "}
                  <span className="text-blood">{sessionStats.lost} lost</span>
                  {sessionStats.abandoned > 0 &&
                    ` · ${sessionStats.abandoned} abandoned`}
                </p>
                {sessionStats.topWinningFaction && (
                  <p className="mt-1 text-xs text-ink-soft">
                    Top winning faction:{" "}
                    <span className="text-ink">
                      {FACTION_LABEL[
                        sessionStats.topWinningFaction as Faction
                      ] ?? sessionStats.topWinningFaction}
                    </span>
                  </p>
                )}
              </div>
            )}

            {m.objectStats != null &&
            typeof m.objectStats === "object" &&
            "totalObjects" in m.objectStats ? (
              <ObjectStatsCard
                stats={m.objectStats as Record<string, unknown>}
              />
            ) : null}

            {(m.victoryCondition || m.lossCondition) && (
              <div className="card-brass rounded p-5">
                <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
                  Conditions
                </h3>
                <dl className="space-y-2 text-sm">
                  {m.victoryCondition && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-soft/80">
                        Victory
                      </dt>
                      <dd className="text-ink">{m.victoryCondition}</dd>
                    </div>
                  )}
                  {m.lossCondition && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-soft/80">
                        Loss
                      </dt>
                      <dd className="text-ink">{m.lossCondition}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {m.factions && m.factions.length > 0 && (
              <div className="card-brass rounded p-5">
                <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
                  Towns
                </h3>
                <ul className="flex flex-wrap gap-3">
                  {(m.factions as Faction[]).map((f) => (
                    <li key={f}>
                      <Link
                        href={`/maps?faction=${f}`}
                        className="flex flex-col items-center gap-1 text-xs text-ink-soft hover:text-ink"
                        title={`Browse ${FACTION_LABEL[f]} maps`}
                      >
                        <FactionCrest faction={f} size={36} />
                        {FACTION_LABEL[f]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card-brass rounded p-5">
              <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
                Origin
              </h3>
              <dl className="space-y-1.5 text-sm">
                <Stat
                  icon="calendar"
                  label="Added"
                  value={
                    m.publishedAt
                      ? new Date(m.publishedAt).toLocaleDateString()
                      : "—"
                  }
                />
                {m.sourceUrl && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-2 text-ink-soft">
                      <StatIcon name="link" />
                      Source
                    </dt>
                    <dd className="truncate">
                      <a
                        href={m.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blood hover:underline"
                      >
                        maps4heroes.com
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>

        {seriesCtx && (
          <SeriesBlock
            series={seriesCtx.series}
            siblings={seriesCtx.siblings}
            thisMapId={m.id}
            thisPosition={seriesCtx.thisPosition}
          />
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">
                Maps like this
              </h2>
              <span className="text-xs text-ink-soft">
                Same series, version, size, players, towns &amp; what others
                played alongside it
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((s, i) => (
                <MapCard key={s.id} map={s} signedIn={signedIn} {...stagger(i)} />
              ))}
            </div>
          </section>
        )}
       </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-ink-soft">
        <StatIcon name={icon} />
        {label}
      </dt>
      <dd className="text-ink font-medium">{value}</dd>
    </div>
  );
}
