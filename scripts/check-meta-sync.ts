/**
 * Verifies the lookup tables in the DB (`map_versions`, `map_sizes`,
 * `difficulty_levels`) match the TS mirror in `src/lib/map-constants.ts`.
 *
 * The DB is canonical — it's referenced by the public API and by
 * server-side rendering. The TS mirror exists only because client
 * components can't await an async DB call during render. This check
 * runs whenever you touch either side and fails loudly if they drift.
 *
 *   npm run check:meta
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import {
  DIFFICULTY_LABEL,
  SIZE_LABEL,
  VERSION_LABEL,
} from "../src/lib/map-constants";

type Row = { code: string; name: string };
type Mismatch = { table: string; reason: string };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  const checks: { table: string; ts: Record<string, string> }[] = [
    { table: "map_versions", ts: VERSION_LABEL },
    { table: "map_sizes", ts: SIZE_LABEL },
    { table: "difficulty_levels", ts: DIFFICULTY_LABEL },
  ];

  const mismatches: Mismatch[] = [];

  for (const { table, ts } of checks) {
    const dbRows = (await sql.unsafe(
      `SELECT code, name FROM "${table}" ORDER BY sort_order`
    )) as Row[];

    const dbMap = new Map(dbRows.map((r) => [r.code, r.name]));
    const dbCodes = new Set(dbMap.keys());
    const tsCodes = new Set(Object.keys(ts));

    for (const c of dbCodes) {
      if (!tsCodes.has(c)) {
        mismatches.push({ table, reason: `${c}: in DB, missing from TS` });
        continue;
      }
      if (dbMap.get(c) !== ts[c]) {
        mismatches.push({
          table,
          reason: `${c}: DB="${dbMap.get(c)}" vs TS="${ts[c]}"`,
        });
      }
    }
    for (const c of tsCodes) {
      if (!dbCodes.has(c)) {
        mismatches.push({ table, reason: `${c}: in TS, missing from DB` });
      }
    }
  }

  await sql.end();

  if (mismatches.length === 0) {
    console.log("✓ DB lookup tables and TS mirror are in sync.");
    return;
  }

  console.error("✗ Drift detected between DB and TS:");
  for (const m of mismatches) {
    console.error(`  [${m.table}] ${m.reason}`);
  }
  console.error(
    "\nFix by editing both `lib/map-constants.ts` and the corresponding\n" +
      "Drizzle migration (or write a new migration that updates the\n" +
      "lookup table to match)."
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
