import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { maps, reviews, users, playSessions, reviewReactions, comments, userMaps } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { ReviewsSection } from "./ReviewsSection";
import { SectionCard } from "@/components/SectionCard";
import { getSeriesContext, getSimilarMaps } from "@/lib/maps";
import { versionLabel } from "@/lib/map-constants";
import { MapCard } from "@/components/MapCard";
import { SeriesBlock } from "@/components/SeriesBlock";
import { CampaignBlock } from "@/components/CampaignBlock";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatIcon, type IconName } from "@/components/StatIcon";
import { IconDownloads, IconRating } from "@/components/nav-icons";
import { MapStats } from "@/components/MapStats";
import { MapThumbnail } from "@/components/MapThumbnail";
import { PageReveal } from "@/components/PageReveal";
import { FactionCrest } from "@/components/FactionCrest";
import { FACTION_LABEL, type Faction } from "@/lib/factions";
import { minDelay } from "@/lib/min-delay";
import { stagger } from "@/lib/stagger";
import { PlayJournal } from "./PlayJournal";
import { PreviewLightboxTrigger } from "./PreviewLightboxTrigger";
import { MapContentIcon, type MapContentKind } from "@/components/MapContentIcon";
import {
  VictoryIcon,
  LossIcon,
  inferVictoryKind,
  inferLossKind,
} from "@/components/ConditionIcon";

function ObjectStatsCard({ stats }: { stats: Record<string, unknown> }) {
  const num = (k: string): number => {
    const v = stats[k];
    return typeof v === "number" ? v : 0;
  };
  const all: Array<[MapContentKind, string, number]> = [
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
    <SectionCard title="Map contents" trailing={<ParserSourceLink />}>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([key, label, n]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2.5 text-ink-soft">
              <MapContentIcon kind={key} size={18} className="text-brass" />
              <span>{label}</span>
            </dt>
            <dd className="text-ink font-medium">{n}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

/**
 * Tiny "i" badge next to the Map Contents heading. On hover/focus it
 * reveals a short tooltip explaining where the numbers come from and
 * links to the parser source on GitHub. Click takes you straight
 * there. CSS-only — no popover lib.
 */
function ParserSourceLink() {
  return (
    <a
      href="https://github.com/pablogday/heroic-maps/tree/main/web/src/lib/h3m"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="About the parser — open source on GitHub"
      className="group relative inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border border-brass/50 text-[10px] font-display leading-none text-ink-soft transition-colors hover:border-brass hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"
    >
      <span aria-hidden>i</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-60 -translate-x-1/2 rounded border border-brass/40 bg-night-deep px-3 py-2 text-left text-[11px] font-normal normal-case tracking-normal text-parchment/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        These counts come from our open-source <code className="text-brass-bright">.h3m</code>{" "}
        parser. Click to view the source on GitHub.
      </span>
    </a>
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

  // Library state for this user/map. Single bookmark flag now —
  // see Path-1 collapse in migration 0011.
  const [libRow] = viewerId
    ? await db
        .select({ bookmarked: userMaps.bookmarked })
        .from(userMaps)
        .where(and(eq(userMaps.userId, viewerId), eq(userMaps.mapId, m.id)))
        .limit(1)
    : [undefined];
  const libState = { bookmarked: libRow?.bookmarked ?? false };

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
          deletedAt: reviews.deletedAt,
        })
        .from(reviews)
        .where(and(eq(reviews.mapId, m.id), eq(reviews.userId, viewerId)))
        .limit(1)
    : [undefined];

  const otherReviews = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
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
        ? and(
            eq(reviews.mapId, m.id),
            ne(reviews.userId, viewerId),
            // Hide soft-deleted reviews from the public list. Admin
            // moderation view (separate page, not built yet) gets the
            // full set.
            sql`${reviews.deletedAt} IS NULL`
          )
        : and(
            eq(reviews.mapId, m.id),
            sql`${reviews.deletedAt} IS NULL`
          )
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
          inArray(reviewReactions.reviewId, ids)
        )
      );
    for (const row of rows) myReactionIds.add(row.reviewId);
  }

  // Comments under reviews. One query for the whole map; group by
  // reviewId in JS. We exclude comments on soft-deleted reviews via
  // the JOIN so threads under removed reviews disappear cleanly.
  const allReviewIds = [
    ...(myReview ? [myReview.id] : []),
    ...otherReviews.map((r) => r.id),
  ];
  const commentRows =
    allReviewIds.length === 0
      ? []
      : await db
          .select({
            id: comments.id,
            reviewId: comments.reviewId,
            userId: comments.userId,
            body: comments.body,
            createdAt: comments.createdAt,
            deletedAt: comments.deletedAt,
            authorName: users.name,
            authorImage: users.image,
            authorUsername: users.username,
          })
          .from(comments)
          .innerJoin(users, eq(users.id, comments.userId))
          .where(inArray(comments.reviewId, allReviewIds))
          .orderBy(comments.reviewId, comments.createdAt);
  const commentsByReview = new Map<number, typeof commentRows>();
  for (const c of commentRows) {
    const list = commentsByReview.get(c.reviewId) ?? [];
    list.push(c);
    commentsByReview.set(c.reviewId, list);
  }
  const viewerIsAdmin = isAdmin(viewerId);

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

            {m.campaignData ? <CampaignBlock data={m.campaignData} /> : null}

            <ReviewsSection
              map={{
                id: m.id,
                slug: m.slug,
                ratingCount: m.ratingCount,
                aiSummary: m.aiSummary,
                aiSummaryReviewCount: m.aiSummaryReviewCount,
              }}
              avgRating={avgRating}
              reviewSort={reviewSort}
              viewerId={viewerId}
              viewerIsAdmin={viewerIsAdmin}
              myReview={myReview}
              otherReviews={otherReviews}
              myReactionIds={myReactionIds}
              commentsByReview={commentsByReview}
            />
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
                  Sign in to bookmark or log a playthrough.
                </p>
              )}
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-ink-soft">
                    <IconDownloads size={16} className="text-brass" />
                    Downloads
                  </dt>
                  <dd className="text-ink font-medium">
                    {m.downloadCount.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-ink-soft">
                    <IconRating size={16} className="text-brass" />
                    Rating
                  </dt>
                  <dd className="text-ink font-medium">
                    {avgRating != null
                      ? `${avgRating.toFixed(1)} (${m.ratingCount})`
                      : "no reviews yet"}
                  </dd>
                </div>
                {/* maps4heroes score is preserved in the DB
                  * (`maps.source_rating`) but hidden from the UI for
                  * now — its scale is unknown so it confuses more than
                  * it helps. Re-enable later if we surface it as a
                  * "popularity" axis on `/stats` or similar. */}
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
              <SectionCard title="Playthroughs">
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
              </SectionCard>
            )}

            {m.objectStats != null &&
            typeof m.objectStats === "object" &&
            "totalObjects" in m.objectStats ? (
              <ObjectStatsCard
                stats={m.objectStats as Record<string, unknown>}
              />
            ) : null}

            {(m.victoryCondition || m.lossCondition) && (
              <SectionCard title="Conditions">
                <dl className="space-y-3 text-sm">
                  {m.victoryCondition && (
                    <div className="flex items-start gap-3">
                      <VictoryIcon
                        kind={inferVictoryKind(m.victoryCondition)}
                        size={26}
                        className="mt-0.5 text-emerald-700/80"
                      />
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs uppercase tracking-wider text-ink-soft/80">
                          Victory
                        </dt>
                        <dd className="text-ink">{m.victoryCondition}</dd>
                      </div>
                    </div>
                  )}
                  {m.lossCondition && (
                    <div className="flex items-start gap-3">
                      <LossIcon
                        kind={inferLossKind(m.lossCondition)}
                        size={26}
                        className="mt-0.5 text-red-800/75"
                      />
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs uppercase tracking-wider text-ink-soft/80">
                          Loss
                        </dt>
                        <dd className="text-ink">{m.lossCondition}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              </SectionCard>
            )}

            {m.factions && m.factions.length > 0 && (
              <SectionCard title="Towns">
                {/* Explicit 5-column grid on desktop, 3 across on
                 * narrow screens. Cells share remaining space evenly
                 * via minmax(0,1fr) so labels can shrink without
                 * pushing the row to wrap. */}
                <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-5">
                  {(m.factions as Faction[]).map((f) => (
                    <li key={f}>
                      <Link
                        href={`/maps?faction=${f}`}
                        className="flex flex-col items-center gap-1 text-center text-[11px] leading-tight text-ink-soft hover:text-ink"
                        title={`Browse ${FACTION_LABEL[f]} maps`}
                      >
                        <FactionCrest faction={f} size={32} />
                        <span className="truncate w-full">{FACTION_LABEL[f]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <SectionCard title="Origin">
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
            </SectionCard>
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
            {/* Stack on mobile — the subtitle is a long sentence and
              * was eating the heading's horizontal space, forcing
              * "Maps / like / this" to wrap one word per line. */}
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
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
