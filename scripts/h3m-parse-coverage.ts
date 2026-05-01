/**
 * Run the .h3m parser against every map's stored file and print a
 * coverage report. Read-only — never writes to the DB.
 *
 *   npm run h3m:coverage              # all maps
 *   npm run h3m:coverage -- --limit=200
 *   npm run h3m:coverage -- --version=SoD
 *   npm run h3m:coverage -- --concurrency=8
 *
 * Use this to track how the parser improves version-by-version. We
 * never merge a parser change that regresses these numbers without a
 * deliberate reason.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { parseH3m, unwrapMapFile } from "../src/lib/h3m";

type Args = {
  limit?: number;
  version?: string;
  concurrency: number;
  verbose: boolean;
};
function parseArgs(): Args {
  const a: Args = { concurrency: 6, verbose: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--verbose") a.verbose = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--version=")) a.version = arg.slice(10);
    else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(16, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

type Bucket = { high: number; partial: number; failed: number; total: number };
const newBucket = (): Bucket => ({ high: 0, partial: 0, failed: 0, total: 0 });

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 4 });

  try {
    const where = ["file_key LIKE 'http%'"];
    if (args.version) where.push(`version = '${args.version}'`);
    const limitClause = args.limit ? `LIMIT ${args.limit}` : "";
    const rows = (await sql.unsafe(
      `SELECT id, slug, version, file_key
       FROM maps
       WHERE ${where.join(" AND ")}
       ORDER BY id ASC
       ${limitClause}`
    )) as Array<{
      id: number;
      slug: string;
      version: string;
      file_key: string;
    }>;

    console.log(`Parsing ${rows.length} maps with concurrency=${args.concurrency}…\n`);

    const byDbVersion = new Map<string, Bucket>();
    const byParsedFormat = new Map<string, Bucket>();
    const errorSamples = new Map<string, string[]>();
    let processed = 0;

    const limit = pLimit(args.concurrency);
    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          const result = await fetchAndParse(row.file_key);
          processed++;
          if (processed % 100 === 0) {
            process.stdout.write(`  …${processed}/${rows.length}\n`);
          }

          const dbBucket =
            byDbVersion.get(row.version) ??
            (byDbVersion.set(row.version, newBucket()),
            byDbVersion.get(row.version)!);
          const parsedBucket =
            byParsedFormat.get(result.format) ??
            (byParsedFormat.set(result.format, newBucket()),
            byParsedFormat.get(result.format)!);

          dbBucket.total++;
          parsedBucket.total++;
          dbBucket[result.confidence]++;
          parsedBucket[result.confidence]++;

          if (result.confidence === "failed" && result.error) {
            const list =
              errorSamples.get(result.error) ??
              (errorSamples.set(result.error, []),
              errorSamples.get(result.error)!);
            if (list.length < 3) list.push(`${row.id} ${row.slug}`);
          }

          if (args.verbose) {
            console.log(
              `${row.id.toString().padStart(5)} ${row.version.padEnd(10)} → ${
                result.format.padEnd(10)
              } ${result.confidence}${
                result.error ? ` (${result.error})` : ""
              }`
            );
          }
        })
      )
    );

    console.log(`\n=== By DB version (what we labeled the map) ===`);
    printTable(byDbVersion);

    console.log(`\n=== By parsed format (what the file actually is) ===`);
    printTable(byParsedFormat);

    if (errorSamples.size > 0) {
      console.log(`\n=== Top failure modes ===`);
      const sorted = [...errorSamples.entries()].sort(
        (a, b) => b[1].length - a[1].length
      );
      for (const [err, samples] of sorted.slice(0, 10)) {
        console.log(`  ${err}`);
        console.log(`    e.g. ${samples.join(", ")}`);
      }
    }
  } finally {
    await sql.end();
  }
}

async function fetchAndParse(
  url: string
): Promise<{
  format: string;
  confidence: "high" | "partial" | "failed";
  error: string | null;
}> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        format: "Unknown",
        confidence: "failed",
        error: `HTTP ${res.status}`,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const unwrapped = unwrapMapFile(buf);
    if (!unwrapped.ok) {
      return {
        format: "Unknown",
        confidence: "failed",
        error: unwrapped.reason,
      };
    }
    const r = parseH3m(Buffer.from(unwrapped.bytes));
    return { format: r.format, confidence: r.confidence, error: r.error };
  } catch (e) {
    return {
      format: "Unknown",
      confidence: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function printTable(m: Map<string, Bucket>) {
  const rows = [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  console.log(
    `  ${"key".padEnd(12)} ${"total".padStart(6)} ${"high".padStart(
      6
    )} ${"partial".padStart(7)} ${"failed".padStart(6)} ${"high%".padStart(7)}`
  );
  for (const [k, b] of rows) {
    const pct = b.total === 0 ? 0 : (b.high / b.total) * 100;
    console.log(
      `  ${k.padEnd(12)} ${b.total.toString().padStart(6)} ${b.high
        .toString()
        .padStart(6)} ${b.partial.toString().padStart(7)} ${b.failed
        .toString()
        .padStart(6)} ${pct.toFixed(1).padStart(6)}%`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
