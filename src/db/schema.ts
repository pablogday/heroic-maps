import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  primaryKey,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const mapSizeEnum = pgEnum("map_size", [
  "S",
  "M",
  "L",
  "XL",
  "H",
  "XH",
  "G",
]);
export const mapVersionEnum = pgEnum("map_version", [
  "RoE",
  "AB",
  "SoD",
  "HotA",
  "WoG",
  "Chronicles",
  "HD",
  "Other",
]);
export const difficultyEnum = pgEnum("difficulty", [
  "easy",
  "normal",
  "hard",
  "expert",
  "impossible",
]);

export const playedOutcomeEnum = pgEnum("played_outcome", [
  "won",
  "lost",
  "abandoned",
]);

/**
 * How the maps in a series relate to each other:
 *   sequel   — Episode I, II, III. Ordered by `series_position`.
 *   variant  — Same map, different difficulty/scenario tweaks.
 *              Order doesn't matter; `series_position` may be null.
 *   remake   — Re-edits, "2.0", "Era Edition", language ports.
 */
export const seriesKindEnum = pgEnum("series_kind", [
  "sequel",
  "variant",
  "remake",
]);

/**
 * Lookup tables for the canonical full names of each enum'd "type".
 * Acts as the source of truth for display labels — both server-side
 * rendering and (eventually) the public API consume these. The TS
 * mirrors in `lib/map-constants.ts` are kept aligned for client code
 * that needs labels without an async DB call.
 */
export const mapVersionsTable = pgTable("map_versions", {
  code: mapVersionEnum("code").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const mapSizesTable = pgTable("map_sizes", {
  code: mapSizeEnum("code").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const difficultyLevelsTable = pgTable("difficulty_levels", {
  code: difficultyEnum("code").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

/**
 * Groups of related maps — sequels, difficulty variants, or re-edits.
 * Populated initially by the heuristic detector
 * (`scripts/detect-series.ts`); refinable later by an AI pass and/or
 * manual admin edits.
 */
export const mapSeriesTable = pgTable(
  "map_series",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    kind: seriesKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("map_series_kind_idx").on(t.kind)]
);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  discordId: varchar("discord_id", { length: 64 }).unique(),
  name: varchar("name", { length: 80 }),
  /** Public URL handle. Lowercase, [a-z0-9_-], 2..30 chars. Used in
   * `/[username]` profile routes. Reserved against route collisions
   * via `lib/reserved-usernames.ts`. */
  username: varchar("username", { length: 30 }).unique(),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Auth.js (NextAuth v5) tables — required by @auth/drizzle-adapter
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const maps = pgTable(
  "maps",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    size: mapSizeEnum("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    hasUnderground: boolean("has_underground").notNull().default(false),

    version: mapVersionEnum("version").notNull(),
    difficulty: difficultyEnum("difficulty"),

    totalPlayers: integer("total_players").notNull(),
    humanPlayers: integer("human_players").notNull(),
    aiPlayers: integer("ai_players").notNull(),
    teamCount: integer("team_count"),

    victoryCondition: text("victory_condition"),
    lossCondition: text("loss_condition"),

    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size"),
    previewKey: text("preview_key"),
    // Underground preview, stored separately because R2 keys don't share
    // the maps4heroes "/img/" → "/img_und/" pattern. Null when the map
    // has no underground level OR when not yet migrated.
    undergroundPreviewKey: text("underground_preview_key"),
    minimapKey: text("minimap_key"),

    uploaderId: text("uploader_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Author name as the original author signed it (community
     * pseudonym). For uploads this stays null — the uploader user
     * relation is authoritative. */
    author: text("author"),
    sourceUrl: text("source_url"),

    downloadCount: integer("download_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    // Popularity score scraped from maps4heroes (their own metric, not 1–5).
    sourceRating: real("source_rating"),

    aiSummary: text("ai_summary"),
    aiSummaryReviewCount: integer("ai_summary_review_count")
      .notNull()
      .default(0),

    /** Counts of map objects by category, populated by the .h3m
     * parser. Null when the parser couldn't fully walk the map's
     * objects (~50% of corpus). Shape:
     *   { towns, heroes, monsters, mines, resources, artifacts,
     *     dwellings, questPoints, oneShotBoosts, decorations,
     *     totalObjects } */
    objectStats: jsonb("object_stats"),

    // Towns/factions present on the map. Best-effort: inferred from
    // description keywords by `scripts/backfill-factions.ts` for now;
    // a future Claude tagging pass will refine.
    factions: text("factions").array(),

    // Series grouping (sequels/variants/remakes). Set by
    // `scripts/detect-series.ts` based on name normalization. Null
    // means "no detected series" — the vast majority will stay null
    // until the AI pass runs.
    seriesId: integer("series_id").references(() => mapSeriesTable.id, {
      onDelete: "set null",
    }),
    seriesPosition: integer("series_position"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("maps_version_idx").on(t.version),
    index("maps_size_idx").on(t.size),
    index("maps_players_idx").on(t.totalPlayers),
    index("maps_downloads_idx").on(t.downloadCount),
    index("maps_published_idx").on(t.publishedAt),
    // GIN index for fast `factions @> ARRAY[...]` containment queries.
    index("maps_factions_idx").using("gin", t.factions),
    // Quick "all maps in this series" lookup, ordered by position.
    index("maps_series_idx").on(t.seriesId, t.seriesPosition),
  ]
);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
});

export const mapTags = pgTable(
  "map_tags",
  {
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.mapId, t.tagId] })]
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body"),
    /** Cached count of "this helped" reactions. Recomputed on every
     * insert/delete in the reviewReactions table. */
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_map_user_unique").on(t.mapId, t.userId),
    index("reviews_map_idx").on(t.mapId),
  ]
);

/**
 * Per-(user, review) "this helped" reactions. Aggregated count is
 * cached on `reviews.helpfulCount` so the detail page can sort/render
 * without an extra join.
 */
export const reviewReactions = pgTable(
  "review_reactions",
  {
    reviewId: integer("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.userId] }),
    index("review_reactions_review_idx").on(t.reviewId),
  ]
);

export const downloads = pgTable(
  "downloads",
  {
    id: serial("id").primaryKey(),
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("downloads_map_idx").on(t.mapId),
    index("downloads_time_idx").on(t.occurredAt),
  ]
);

export const mapsRelations = relations(maps, ({ one, many }) => ({
  uploader: one(users, { fields: [maps.uploaderId], references: [users.id] }),
  reviews: many(reviews),
  tags: many(mapTags),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  map: one(maps, { fields: [reviews.mapId], references: [maps.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));

export const mapTagsRelations = relations(mapTags, ({ one }) => ({
  map: one(maps, { fields: [mapTags.mapId], references: [maps.id] }),
  tag: one(tags, { fields: [mapTags.tagId], references: [tags.id] }),
}));

/**
 * Per-(user, map) tracking: favorite, bookmark, and played status.
 * One row per relationship — when all flags clear we delete the row.
 */
export const userMaps = pgTable(
  "user_maps",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),

    favorited: boolean("favorited").notNull().default(false),
    bookmarked: boolean("bookmarked").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mapId] }),
    index("user_maps_user_fav_idx").on(t.userId, t.favorited),
    index("user_maps_user_bookmark_idx").on(t.userId, t.bookmarked),
  ]
);

/**
 * One row per user-recorded playthrough of a map. A single user can
 * have multiple sessions for the same map (different factions,
 * different outcomes, replays). This is the journal: the source of
 * truth for "played" data.
 *
 * The legacy `userMaps.playedAt`/`playedOutcome`/`playedNotes` columns
 * have been retired; "has the user played this map" is now derived
 * from `EXISTS (SELECT 1 FROM play_sessions ...)`.
 */
export const playSessions = pgTable(
  "play_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mapId: integer("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),

    /** When the playthrough happened (user-supplied; defaults to insert time). */
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Which faction the user played as. Optional — some sessions are
     * "I tried this map" without a specific faction record. */
    faction: text("faction"),
    outcome: playedOutcomeEnum("outcome").notNull(),
    /** In-game days taken to reach the end state. Optional. */
    durationDays: integer("duration_days"),
    notes: text("notes"),
    /** Public sessions appear on the map's "recent playthroughs" feed
     * and (eventually) the user's public profile. Private = only the
     * user sees them. */
    isPublic: boolean("is_public").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("play_sessions_user_played_idx").on(t.userId, t.playedAt),
    index("play_sessions_map_played_idx").on(t.mapId, t.playedAt),
    index("play_sessions_user_map_idx").on(t.userId, t.mapId),
  ]
);

export const playSessionsRelations = relations(playSessions, ({ one }) => ({
  user: one(users, { fields: [playSessions.userId], references: [users.id] }),
  map: one(maps, { fields: [playSessions.mapId], references: [maps.id] }),
}));

export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserMap = typeof userMaps.$inferSelect;
export type PlaySession = typeof playSessions.$inferSelect;
export type NewPlaySession = typeof playSessions.$inferInsert;

// silence unused import in future expansion
export const _sql = sql;
