/**
 * Re-import a snapshot produced by `scripts/snapshot-data.ts` into a
 * Drizzle-migrated database.
 *
 * Steps to recover from a worst-case data loss:
 *   1. Create a fresh Neon DB or branch
 *   2. Point DATABASE_URL at it
 *   3. `npm run db:migrate`            (rebuilds schema from migrations)
 *   4. `npm run db:restore -- backups/2026-…`  (replays this script)
 *
 * Safety rails:
 *   - Refuses to run unless every target table is empty (avoid clobbering
 *     a populated DB by accident).
 *   - Inserts inside a single transaction so a failure halfway leaves
 *     the DB untouched.
 *   - Restores sequence values so future inserts don't collide with
 *     restored row ids.
 *
 * Auth tables (sessions/accounts/verification_tokens) are not in the
 * snapshot — users will need to sign in again.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

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
  const dirArg = process.argv[2];
  if (!dirArg) {
    console.error("Usage: tsx scripts/restore-data.ts <snapshot-dir>");
    process.exit(1);
  }
  const dir = path.resolve(dirArg);
  if (!fs.existsSync(dir)) throw new Error(`No such directory: ${dir}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  // Refuse to clobber. Every table must be empty.
  for (const t of TABLES) {
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(t)}
    `;
    if (n > 0) {
      throw new Error(
        `Refusing to restore: table "${t}" already has ${n} rows. Restore expects an empty schema.`
      );
    }
  }

  await sql.begin(async (tx) => {
    for (const t of TABLES) {
      const file = path.join(dir, `${t}.json`);
      if (!fs.existsSync(file)) {
        console.warn(`  ${t}: no JSON in snapshot, skipping`);
        continue;
      }
      const rows: Record<string, unknown>[] = JSON.parse(
        fs.readFileSync(file, "utf8")
      );
      if (rows.length === 0) {
        console.log(`  ${t.padEnd(12)}  0 rows`);
        continue;
      }

      // Chunk inserts to stay under Postgres' 65,534 parameter cap
      // (a wide table like `maps` can hit it in a single batch).
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        await tx`INSERT INTO ${tx(t)} ${tx(slice)}`;
      }
      console.log(`  ${t.padEnd(12)}  ${rows.length.toLocaleString()} rows`);
    }

    // Reset sequences so newly-inserted rows don't collide with
    // restored ids. Postgres exposes pg_get_serial_sequence + setval.
    for (const t of TABLES) {
      const cols = await tx<{ column: string }[]>`
        SELECT column_name AS column
        FROM information_schema.columns
        WHERE table_name = ${t} AND column_default LIKE 'nextval%'
      `;
      for (const { column } of cols) {
        await tx.unsafe(
          `SELECT setval(pg_get_serial_sequence('${t}', '${column}'),
            COALESCE((SELECT MAX("${column}") FROM "${t}"), 1),
            (SELECT MAX("${column}") FROM "${t}") IS NOT NULL)`
        );
      }
    }
  });

  await sql.end();
  console.log(`\nRestored from: ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
