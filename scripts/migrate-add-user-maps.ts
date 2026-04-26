/**
 * One-off migration: create the user_maps table for favorites,
 * bookmarks, and "I played this" tracking. Idempotent.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  await sql`DO $$ BEGIN
    CREATE TYPE played_outcome AS ENUM ('won', 'lost', 'abandoned');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_maps (
      user_id        text    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      map_id         integer NOT NULL REFERENCES maps(id)  ON DELETE CASCADE,
      favorited      boolean NOT NULL DEFAULT false,
      bookmarked     boolean NOT NULL DEFAULT false,
      played_at      timestamptz,
      played_outcome played_outcome,
      played_notes   text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, map_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS user_maps_user_fav_idx       ON user_maps(user_id, favorited)`;
  await sql`CREATE INDEX IF NOT EXISTS user_maps_user_bookmark_idx ON user_maps(user_id, bookmarked)`;
  await sql`CREATE INDEX IF NOT EXISTS user_maps_user_played_idx   ON user_maps(user_id, played_at)`;

  console.log("user_maps table + indexes ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
