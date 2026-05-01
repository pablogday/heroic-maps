/**
 * Manual data snapshot. Dumps every user-data table to a timestamped
 * JSON file under `backups/`. Schema isn't included — that lives in git
 * via Drizzle migrations, so schema + this snapshot together are a full
 * reproducible backup.
 *
 * Run before any operation that might lose or mutate data unpredictably:
 *   npm run db:snapshot
 *
 * To restore: re-create a fresh DB from migrations
 *   (`npm run db:migrate`), then re-insert rows from the JSON dump using
 *   a small script or psql `\copy` per table.
 *
 * Auth.js tables (sessions, accounts, verification_tokens) are
 * intentionally excluded — they're transient and worth letting users
 * just sign in again rather than leaking refresh tokens to disk.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

/**
 * Tables to snapshot. Order doesn't matter for the dump itself, but
 * matters when reimporting (parents first to satisfy FKs).
 * Auth tables omitted on purpose.
 */
const TABLES = [
  "users",
  "tags",
  "maps",
  "map_tags",
  "reviews",
  "user_maps",
  "downloads",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const sql = postgres(url, { max: 1 });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve("backups", stamp);
  fs.mkdirSync(dir, { recursive: true });

  const summary: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = await sql.unsafe(`SELECT * FROM "${table}"`);
    fs.writeFileSync(
      path.join(dir, `${table}.json`),
      JSON.stringify(rows, null, 2)
    );
    summary[table] = rows.length;
    console.log(`  ${table.padEnd(12)}  ${rows.length.toLocaleString()} rows`);
  }

  fs.writeFileSync(
    path.join(dir, "_meta.json"),
    JSON.stringify(
      {
        snapshotAt: new Date().toISOString(),
        rowCounts: summary,
        // We embed the latest applied migration so a restore knows what
        // schema state these rows expect.
        appliedMigrations: await sql<{ hash: string; created_at: string }[]>`
          SELECT hash, created_at
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at ASC
        `,
      },
      null,
      2
    )
  );

  await sql.end();
  console.log(`\nSnapshot written to: ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
