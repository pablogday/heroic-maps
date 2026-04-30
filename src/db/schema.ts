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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  discordId: varchar("discord_id", { length: 64 }).unique(),
  name: varchar("name", { length: 80 }),
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
    minimapKey: text("minimap_key"),

    uploaderId: text("uploader_id").references(() => users.id, {
      onDelete: "set null",
    }),
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

    // Towns/factions present on the map. Best-effort: inferred from
    // description keywords by `scripts/backfill-factions.ts` for now;
    // a future Claude tagging pass will refine.
    factions: text("factions").array(),

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_map_user_unique").on(t.mapId, t.userId),
    index("reviews_map_idx").on(t.mapId),
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

    playedAt: timestamp("played_at", { withTimezone: true }),
    playedOutcome: playedOutcomeEnum("played_outcome"),
    playedNotes: text("played_notes"),

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
    index("user_maps_user_played_idx").on(t.userId, t.playedAt),
  ]
);

export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserMap = typeof userMaps.$inferSelect;

// silence unused import in future expansion
export const _sql = sql;
