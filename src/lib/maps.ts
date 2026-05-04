import "server-only";
import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  maps,
  mapSeriesTable,
  reviews,
  userMaps,
  users,
  playSessions,
} from "@/db/schema";
import type { Faction } from "./factions";
import type { Difficulty, Size, Sort, Version } from "./map-constants";

export * from "./map-constants";

export type MapFilters = {
  q?: string;
  version?: Version;
  size?: Size;
  players?: number;
  /** Empty/undefined = no faction filter. Multi-select uses OR
   * semantics: a map matches if it contains ANY of the selected
   * factions. */
  factions?: Faction[];
  difficulty?: Difficulty;
  /** True = only underground maps; false = only surface-only; undefined = either. */
  hasUnderground?: boolean;
  sort?: Sort;
  page?: number;
};

const PAGE_SIZE = 24;

/**
 * Shared select shape for `<MapCard>` data. Every list-style query in this
 * file returns rows compatible with `MapCardData` so the UI has a single
 * source of truth for what a card needs.
 */
/**
 * Canonical SELECT shape for any list query that feeds `<MapCard>`.
 * Exported so other pages (`/library`, `/series/[slug]`, `/[username]`,
 * the cron job, etc.) can use the same shape without duplicating
 * fifteen-column lists.
 *
 * Pair with `MapCardData` below — they always evolve together.
 */
export const mapCardCols = {
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
  // Truthy when this row's file is a `.h3c` campaign archive — used
  // by MapCard to flip the "Campaign" badge.
  isCampaign: sql<boolean>`(${maps.campaignData} IS NOT NULL)`,
};

// Internal alias used throughout this file for terseness.
const cardCols = mapCardCols;

export type MapCardData = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  version: string;
  size: string;
  humanPlayers: number;
  totalPlayers: number;
  ratingSum: number;
  ratingCount: number;
  previewKey: string | null;
  undergroundPreviewKey: string | null;
  hasUnderground: boolean;
  factions: string[] | null;
  downloadCount: number;
  isCampaign: boolean;
  bookmarked: boolean;
};

/**
 * Adds the per-viewer `bookmarked` flag via a LEFT JOIN. When
 * `viewerId` is null we substitute a sentinel id that can never
 * match any user_id, so the join always emits NULLs and the flag
 * collapses to false.
 */
const bookmarkedExpr = sql<boolean>`COALESCE(${userMaps.bookmarked}, false)`;
function joinUserMapsOn(viewerId: string | null) {
  return and(
    eq(userMaps.mapId, maps.id),
    eq(userMaps.userId, viewerId ?? "__no_viewer__")
  );
}

export async function listMaps(f: MapFilters, viewerId: string | null = null) {
  const where: SQL[] = [];
  if (f.q) where.push(ilike(maps.name, `%${f.q}%`));
  if (f.version) where.push(eq(maps.version, f.version));
  if (f.size) where.push(eq(maps.size, f.size));
  if (f.players != null) {
    where.push(gte(maps.totalPlayers, f.players));
    where.push(lte(maps.humanPlayers, f.players));
  }
  if (f.factions && f.factions.length > 0) {
    // Array-overlap (`&&`): row matches when any selected faction
    // appears in `maps.factions`. OR semantics across the multi-
    // select. Casting to text[] because `maps.factions` is text[].
    where.push(
      sql`${maps.factions} && ARRAY[${sql.join(
        f.factions.map((x) => sql`${x}`),
        sql`, `
      )}]::text[]`
    );
  }
  if (f.difficulty) {
    where.push(eq(maps.difficulty, f.difficulty));
  }
  if (f.hasUnderground !== undefined) {
    where.push(eq(maps.hasUnderground, f.hasUnderground));
  }

  const orderBy = (() => {
    switch (f.sort) {
      case "rating":
        return [
          desc(
            sql`CASE WHEN ${maps.ratingCount} > 0 THEN ${maps.ratingSum}::float / ${maps.ratingCount} ELSE NULL END`
          ),
          desc(maps.sourceRating),
        ];
      case "newest":
        return desc(maps.publishedAt);
      case "name":
        return maps.name;
      case "downloads":
      default:
        return desc(maps.downloadCount);
    }
  })();

  const page = Math.max(1, f.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const whereClause = where.length ? and(...where) : undefined;
  const orderByArgs = Array.isArray(orderBy) ? orderBy : [orderBy];

  const [rows, totalRows] = await Promise.all([
    db
      .select({ ...cardCols, bookmarked: bookmarkedExpr })
      .from(maps)
      .leftJoin(userMaps, joinUserMapsOn(viewerId))
      .where(whereClause)
      .orderBy(...orderByArgs)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(maps)
      .where(whereClause),
  ]);

  return {
    items: rows as MapCardData[],
    page,
    pageSize: PAGE_SIZE,
    total: totalRows[0]?.n ?? 0,
  };
}

/**
 * Map size tiers, ordered. Used by `getSimilarMaps` to find maps within
 * one tier of the given map's size.
 */
const SIZE_ORDER: Record<string, number> = {
  S: 0, M: 1, L: 2, XL: 3, H: 4, XH: 5, G: 6,
};

const DIFFICULTY_RANK: Record<string, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  expert: 3,
  impossible: 4,
};

/**
 * Recommendations engine. Score is a sum of multiple signals; the
 * weights below were tuned for "feels right" rather than via
 * empirical evals (we don't have the data yet).
 *
 * Signals:
 *   +3   same version (RoE/SoD/HotA/...)
 *   +5   same series (huge — sequels almost always belong together)
 *   +2   same hasUnderground
 *   +(3 - sizeDistance)        — same size = +3, ±1 tier = +2, ±2 = +1
 *   +(3 - playerDistance)      — same player count = +3
 *   +(3 - difficultyDistance)  — same difficulty = +3
 *   +1.5 × shared factions
 *   +0.5 × co_play_overlap     — users who played X also played candidate
 *   + min(2, log10(downloads+1) / 2)         — quality nudge
 *   + min(2, avg_rating - 3)                  — well-rated nudge (centered at 3)
 *   -10  viewer has already played candidate (don't recommend dupes)
 *
 * Ties broken randomly so repeat visits still surface variety.
 */
export async function getSimilarMaps(
  map: {
    id: number;
    version: string;
    size: string;
    totalPlayers: number;
    hasUnderground: boolean;
    factions: string[] | null;
    seriesId: number | null;
    difficulty: string | null;
  },
  n = 3,
  viewerId: string | null = null
) {
  const sizeRank = SIZE_ORDER[map.size] ?? 1;
  const difficultyRank =
    map.difficulty != null ? DIFFICULTY_RANK[map.difficulty] : null;
  const factions = map.factions ?? [];

  const factionsArr = sql`ARRAY[${sql.join(
    factions.length ? factions.map((f) => sql`${f}`) : [sql`''`],
    sql`, `
  )}]::text[]`;

  const sizeRankCase = sql`CASE ${maps.size}
    WHEN 'S' THEN 0 WHEN 'M' THEN 1 WHEN 'L' THEN 2 WHEN 'XL' THEN 3
    WHEN 'H' THEN 4 WHEN 'XH' THEN 5 WHEN 'G' THEN 6 ELSE 1 END`;

  const difficultyRankCase = sql`CASE ${maps.difficulty}
    WHEN 'easy' THEN 0 WHEN 'normal' THEN 1 WHEN 'hard' THEN 2
    WHEN 'expert' THEN 3 WHEN 'impossible' THEN 4 ELSE NULL END`;

  // Co-play signal: count users who played the source map AND each
  // candidate. Cheap subquery — usually small.
  const coPlayOverlap = sql<number>`COALESCE((
    SELECT COUNT(DISTINCT a.user_id)::int
    FROM ${playSessions} a
    INNER JOIN ${playSessions} b ON b.user_id = a.user_id
    WHERE a.map_id = ${map.id}
      AND b.map_id = ${maps.id}
      AND b.map_id <> ${map.id}
  ), 0)`;

  const viewerPlayedPenalty = viewerId
    ? sql<number>`(CASE WHEN EXISTS (
        SELECT 1 FROM ${playSessions}
        WHERE user_id = ${viewerId} AND map_id = ${maps.id}
      ) THEN -10 ELSE 0 END)`
    : sql<number>`0`;

  const seriesBoost =
    map.seriesId != null
      ? sql<number>`(CASE WHEN ${maps.seriesId} = ${map.seriesId} THEN 5 ELSE 0 END)`
      : sql<number>`0`;

  const difficultyScore =
    difficultyRank != null
      ? sql<number>`COALESCE(GREATEST(0, 3 - ABS(${difficultyRankCase} - ${difficultyRank})), 0)`
      : sql<number>`0`;

  const score = sql<number>`
    (CASE WHEN ${maps.version} = ${map.version} THEN 3 ELSE 0 END)
    + ${seriesBoost}
    + (CASE WHEN ${maps.hasUnderground} = ${map.hasUnderground} THEN 2 ELSE 0 END)
    + GREATEST(0, 3 - ABS(${sizeRankCase} - ${sizeRank}))
    + GREATEST(0, 3 - ABS(${maps.totalPlayers} - ${map.totalPlayers}))
    + ${difficultyScore}
    + 1.5 * COALESCE(array_length(
        ARRAY(SELECT unnest(${maps.factions}) INTERSECT SELECT unnest(${factionsArr})),
        1
      ), 0)
    + 0.5 * ${coPlayOverlap}
    + LEAST(2, LOG(10, ${maps.downloadCount} + 1) / 2.0)
    + LEAST(2, GREATEST(0,
        CASE WHEN ${maps.ratingCount} > 0
        THEN (${maps.ratingSum}::float / ${maps.ratingCount}) - 3
        ELSE 0 END
      ))
    + ${viewerPlayedPenalty}
  `;

  const rows = await db
    .select({ ...cardCols, bookmarked: bookmarkedExpr, score })
    .from(maps)
    .leftJoin(userMaps, joinUserMapsOn(viewerId))
    .where(sql`${maps.id} <> ${map.id}`)
    .orderBy(desc(score), sql`random()`)
    .limit(n);

  return rows as (MapCardData & { score: number })[];
}

/**
 * Top-rated featured maps for the homepage.
 */
export async function getFeaturedMaps(
  limit = 3,
  viewerId: string | null = null
) {
  const rows = await db
    .select({ ...cardCols, bookmarked: bookmarkedExpr })
    .from(maps)
    .leftJoin(userMaps, joinUserMapsOn(viewerId))
    .orderBy(desc(maps.sourceRating))
    .limit(limit);
  return rows as MapCardData[];
}

/**
 * Recently added maps. Falls back to `createdAt` when `publishedAt` is
 * null (most scraped rows don't have a published date).
 *
 * Returns a slim shape for the homepage activity strip — not a full
 * MapCard payload.
 */
export async function getRecentlyAdded(limit = 6) {
  return db
    .select({
      id: maps.id,
      slug: maps.slug,
      name: maps.name,
      version: maps.version,
      previewKey: maps.previewKey,
      ratingSum: maps.ratingSum,
      ratingCount: maps.ratingCount,
      addedAt: sql<Date>`COALESCE(${maps.publishedAt}, ${maps.createdAt})`.as(
        "added_at"
      ),
    })
    .from(maps)
    .orderBy(desc(sql`COALESCE(${maps.publishedAt}, ${maps.createdAt})`))
    .limit(limit);
}

/**
 * Recently reviewed maps — one row per review, joined to map + reviewer.
 * Latest first.
 */
export async function getRecentlyReviewed(limit = 6) {
  return db
    .select({
      reviewId: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
      mapId: maps.id,
      mapSlug: maps.slug,
      mapName: maps.name,
      mapPreview: maps.previewKey,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(reviews)
    .innerJoin(maps, eq(reviews.mapId, maps.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/**
 * Returns the series this map belongs to (if any) plus its sibling
 * entries — for showing the "Part of X" block on the detail page.
 *
 * Sorting: by `seriesPosition` for sequels (so prev/next nav makes
 * sense), alphabetical fallback for variants/remakes where position
 * is null.
 */
export async function getSeriesContext(mapId: number) {
  // Fetch this map's series, then siblings, in parallel-ish.
  const [meta] = await db
    .select({
      seriesId: maps.seriesId,
      seriesPosition: maps.seriesPosition,
    })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (!meta?.seriesId) return null;

  const [[series], siblings] = await Promise.all([
    db
      .select({
        id: mapSeriesTable.id,
        slug: mapSeriesTable.slug,
        name: mapSeriesTable.name,
        kind: mapSeriesTable.kind,
        description: mapSeriesTable.description,
      })
      .from(mapSeriesTable)
      .where(eq(mapSeriesTable.id, meta.seriesId))
      .limit(1),
    db
      .select({
        id: maps.id,
        slug: maps.slug,
        name: maps.name,
        version: maps.version,
        previewKey: maps.previewKey,
        seriesPosition: maps.seriesPosition,
      })
      .from(maps)
      .where(eq(maps.seriesId, meta.seriesId))
      .orderBy(
        // Nulls last so positioned sequels lead, unpositioned siblings
        // (variants/remakes) fall to the bottom alphabetically.
        sql`${maps.seriesPosition} ASC NULLS LAST`,
        maps.name
      ),
  ]);

  if (!series) return null;

  return {
    series,
    thisPosition: meta.seriesPosition,
    siblings, // includes the current map; UI decides whether to skip it
  };
}
