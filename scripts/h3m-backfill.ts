/**
 * Read every map's stored .h3m, parse it, and backfill empty
 * victory_condition / loss_condition columns in Postgres.
 *
 *   npm exec tsx scripts/h3m-backfill.ts -- --dry        # report only
 *   npm exec tsx scripts/h3m-backfill.ts --              # write
 *   npm exec tsx scripts/h3m-backfill.ts -- --limit=200
 *   npm exec tsx scripts/h3m-backfill.ts -- --version=SoD
 *   npm exec tsx scripts/h3m-backfill.ts -- --fill-factions  # also fill empty factions arrays
 *
 * Idempotent: only writes when the existing column is NULL
 * (or factions are NULL/empty). Re-run safely picks up where it left
 * off after a crash.
 *
 * Conservative: never overwrites existing data. If the scraper got
 * something wrong, fix it via Drizzle migration or a separate
 * targeted script — not here.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { parseH3m, unwrapMapFile } from "../src/lib/h3m";

type Args = {
  dry: boolean;
  limit?: number;
  version?: string;
  concurrency: number;
  fillFactions: boolean;
};
function parseArgs(): Args {
  const a: Args = { dry: false, concurrency: 6, fillFactions: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--fill-factions") a.fillFactions = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--version=")) a.version = arg.slice(10);
    else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(16, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

type Stats = {
  considered: number;
  parsed: number;
  unparseable: number;
  victoryWritten: number;
  lossWritten: number;
  factionsWritten: number;
  alreadyFilled: number;
  errors: number;
};

async function main() {
  const args = parseArgs();
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });

  try {
    const where = ["file_key LIKE 'http%'"];
    if (args.version) where.push(`version = '${args.version}'`);
    const limitClause = args.limit ? `LIMIT ${args.limit}` : "";
    const rows = (await sql.unsafe(
      `SELECT id, slug, file_key, victory_condition, loss_condition, factions
       FROM maps
       WHERE ${where.join(" AND ")}
       ORDER BY id ASC
       ${limitClause}`
    )) as Array<{
      id: number;
      slug: string;
      file_key: string;
      victory_condition: string | null;
      loss_condition: string | null;
      factions: string[] | null;
    }>;

    console.log(
      `${args.dry ? "[DRY] " : ""}Backfilling ${rows.length} maps with concurrency=${args.concurrency}\n`
    );

    const stats: Stats = {
      considered: rows.length,
      parsed: 0,
      unparseable: 0,
      victoryWritten: 0,
      lossWritten: 0,
      factionsWritten: 0,
      alreadyFilled: 0,
      errors: 0,
    };

    const limit = pLimit(args.concurrency);
    let processed = 0;
    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          await processMap(sql, row, args, stats);
          processed++;
          if (processed % 100 === 0) {
            process.stdout.write(`  …${processed}/${rows.length}\n`);
          }
        })
      )
    );

    console.log("\n=== Result ===");
    for (const [k, v] of Object.entries(stats)) {
      console.log(`  ${k.padEnd(18)} ${v}`);
    }
    if (args.dry) {
      console.log("\n(dry run — no rows written)");
    }
  } finally {
    await sql.end();
  }
}

async function processMap(
  sql: postgres.Sql,
  row: {
    id: number;
    slug: string;
    file_key: string;
    victory_condition: string | null;
    loss_condition: string | null;
    factions: string[] | null;
  },
  args: Args,
  stats: Stats
) {
  const needsVictory = row.victory_condition === null;
  const needsLoss = row.loss_condition === null;
  const needsFactions =
    args.fillFactions && (row.factions === null || row.factions.length === 0);
  if (!needsVictory && !needsLoss && !needsFactions) {
    stats.alreadyFilled++;
    return;
  }

  let parsed;
  try {
    const res = await fetch(row.file_key);
    if (!res.ok) {
      stats.unparseable++;
      return;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const unwrapped = await unwrapMapFile(buf);
    if (!unwrapped.ok) {
      stats.unparseable++;
      return;
    }
    parsed = parseH3m(unwrapped.bytes);
  } catch {
    stats.errors++;
    return;
  }

  if (parsed.confidence === "failed") {
    stats.unparseable++;
    return;
  }
  stats.parsed++;

  const updates: string[] = [];
  const values: Array<string | string[]> = [];
  if (needsVictory && parsed.victory) {
    updates.push(`victory_condition = $${updates.length + 1}`);
    values.push(parsed.victory.description);
    stats.victoryWritten++;
  }
  if (needsLoss && parsed.loss) {
    updates.push(`loss_condition = $${updates.length + 1}`);
    values.push(parsed.loss.description);
    stats.lossWritten++;
  }
  if (needsFactions && parsed.factions && parsed.factions.length > 0) {
    updates.push(`factions = $${updates.length + 1}`);
    values.push(parsed.factions);
    stats.factionsWritten++;
  }
  if (updates.length === 0) return;

  if (args.dry) return;

  await sql.unsafe(
    `UPDATE maps SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ${row.id}`,
    values
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
