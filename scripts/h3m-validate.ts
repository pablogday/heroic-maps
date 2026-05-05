/**
 * Compare what the parser extracts vs. what the scraper stored in
 * the DB for every map we can parse. Surfaces disagreements grouped
 * by field — these are either parser bugs (most likely) or scraper
 * bugs (less likely; the scraper read maps4heroes.com's HTML which
 * is ground truth via the original site's parsing).
 *
 *   npm exec tsx scripts/h3m-validate.ts
 *   npm exec tsx scripts/h3m-validate.ts -- --version=SoD --limit=200
 *   npm exec tsx scripts/h3m-validate.ts -- --field=name --verbose
 *
 * Read-only — never writes. Safe to run anytime.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { parseH3m, unwrapMapFile } from "../src/lib/h3m";

type Args = {
  limit?: number;
  version?: string;
  field?: string;
  concurrency: number;
  verbose: boolean;
};
function parseArgs(): Args {
  const a: Args = { concurrency: 6, verbose: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--verbose") a.verbose = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--version=")) a.version = arg.slice(10);
    else if (arg.startsWith("--field=")) a.field = arg.slice(8);
    else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(16, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

type Disagreement = {
  field: string;
  mapId: number;
  slug: string;
  dbValue: unknown;
  parsedValue: unknown;
};

async function main() {
  const args = parseArgs();
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  try {
    const where = ["file_key LIKE 'http%'"];
    if (args.version) where.push(`version = '${args.version}'`);
    const limitClause = args.limit ? `LIMIT ${args.limit}` : "";
    const rows = (await sql.unsafe(
      `SELECT id, slug, name, size, has_underground, version,
              human_players, ai_players, total_players, factions, file_key
       FROM maps WHERE ${where.join(" AND ")} ORDER BY id ${limitClause}`
    )) as Array<{
      id: number;
      slug: string;
      name: string;
      size: string;
      has_underground: boolean;
      version: string;
      human_players: number;
      ai_players: number;
      total_players: number;
      factions: string[] | null;
      file_key: string;
    }>;

    console.log(`Validating ${rows.length} maps…\n`);

    const disagreements: Disagreement[] = [];
    const checkedByField = new Map<string, number>();
    let parsed = 0;
    let unparseable = 0;

    const limit = pLimit(args.concurrency);
    let processed = 0;
    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          await checkMap(row, disagreements, checkedByField, args).then(
            (status) => {
              if (status === "parsed") parsed++;
              else if (status === "unparseable") unparseable++;
            }
          );
          processed++;
          if (processed % 200 === 0) {
            process.stdout.write(`  …${processed}/${rows.length}\n`);
          }
        })
      )
    );

    // Group disagreements by field
    const byField = new Map<string, Disagreement[]>();
    for (const d of disagreements) {
      if (args.field && d.field !== args.field) continue;
      if (!byField.has(d.field)) byField.set(d.field, []);
      byField.get(d.field)!.push(d);
    }

    console.log(`\n=== Summary ===`);
    console.log(`  parsed:       ${parsed}`);
    console.log(`  unparseable:  ${unparseable}`);
    console.log(`  total:        ${rows.length}\n`);

    console.log(`=== Field disagreement rates (lower = better) ===`);
    const fields = [...checkedByField.keys()].sort();
    for (const field of fields) {
      const checked = checkedByField.get(field)!;
      const disagreed = byField.get(field)?.length ?? 0;
      const pct = checked === 0 ? 0 : (100 * disagreed) / checked;
      console.log(
        `  ${field.padEnd(18)} ${disagreed
          .toString()
          .padStart(5)} / ${checked.toString().padStart(5)} disagreements (${pct
          .toFixed(2)
          .padStart(5)}%)`
      );
    }

    if (args.verbose && byField.size > 0) {
      console.log(`\n=== Sample disagreements ===`);
      for (const [field, list] of byField) {
        console.log(`\n--- ${field} (${list.length}) ---`);
        for (const d of list.slice(0, 8)) {
          console.log(
            `  #${d.mapId} ${d.slug}\n    db:     ${JSON.stringify(d.dbValue)}\n    parsed: ${JSON.stringify(d.parsedValue)}`
          );
        }
        if (list.length > 8) console.log(`  …${list.length - 8} more`);
      }
    }
  } finally {
    await sql.end();
  }
}

async function checkMap(
  row: {
    id: number;
    slug: string;
    name: string;
    size: string;
    has_underground: boolean;
    version: string;
    human_players: number;
    ai_players: number;
    total_players: number;
    factions: string[] | null;
    file_key: string;
  },
  out: Disagreement[],
  checkedByField: Map<string, number>,
  args: Args
): Promise<"parsed" | "unparseable" | "skipped"> {
  let bytes: Uint8Array;
  try {
    const res = await fetch(row.file_key);
    if (!res.ok) return "unparseable";
    const archive = new Uint8Array(await res.arrayBuffer());
    const unwrapped = await unwrapMapFile(archive);
    if (!unwrapped.ok) return "unparseable";
    bytes = unwrapped.bytes;
  } catch {
    return "unparseable";
  }

  const r = parseH3m(bytes);
  if (r.confidence === "failed" || !r.header) return "unparseable";

  const checks: Array<[string, unknown, unknown]> = [
    ["name", row.name, r.header.name],
    ["size", row.size, r.header.size],
    ["has_underground", row.has_underground, r.header.hasUnderground],
    ["mapVersion", row.version, r.mapVersion],
  ];
  if (r.totalPlayers !== null) {
    checks.push(["total_players", row.total_players, r.totalPlayers]);
    checks.push(["human_players", row.human_players, r.humanPlayers]);
    checks.push(["ai_players", row.ai_players, r.aiPlayers]);
  }
  if (r.factions !== null && row.factions !== null && row.factions.length > 0) {
    // Compare as sorted sets so order doesn't matter
    const dbSet = [...row.factions].sort().join(",");
    const parsedSet = [...r.factions].sort().join(",");
    checks.push(["factions", dbSet, parsedSet]);
  }

  for (const [field, dbValue, parsedValue] of checks) {
    checkedByField.set(field, (checkedByField.get(field) ?? 0) + 1);
    if (!equal(dbValue, parsedValue, field)) {
      out.push({ field, mapId: row.id, slug: row.slug, dbValue, parsedValue });
    }
  }
  void args;
  return "parsed";
}

/** Field-aware equality: name fuzzes whitespace, version is a one-way map. */
function equal(a: unknown, b: unknown, field: string): boolean {
  if (field === "name") {
    return normName(a as string) === normName(b as string);
  }
  return a === b;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
