/**
 * One-off migration: add maps.factions text[] column + GIN index.
 * Idempotent — safe to re-run.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  await sql`ALTER TABLE maps ADD COLUMN IF NOT EXISTS factions text[]`;
  await sql`CREATE INDEX IF NOT EXISTS maps_factions_idx ON maps USING GIN (factions)`;

  console.log("factions column + GIN index ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
