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
import { parseH3m, unwrapMapFile, terrainPlausibility } from "../src/lib/h3m";

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
    const victoryHistogram = new Map<string, number>();
    const lossHistogram = new Map<string, number>();
    const playerCountHistogram = new Map<number, number>();
    let terrainReached = 0;
    let terrainPlausible = 0;
    let objectsFullyParsed = 0;
    let objectsEventsSane = 0;
    let objectsPartial = 0;
    const unsupportedClasses = new Map<string, number>();
    let highParsed = 0;
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

          if (result.victoryType) {
            victoryHistogram.set(
              result.victoryType,
              (victoryHistogram.get(result.victoryType) ?? 0) + 1
            );
          }
          if (result.lossType) {
            lossHistogram.set(
              result.lossType,
              (lossHistogram.get(result.lossType) ?? 0) + 1
            );
          }
          if (result.totalPlayers !== null) {
            playerCountHistogram.set(
              result.totalPlayers,
              (playerCountHistogram.get(result.totalPlayers) ?? 0) + 1
            );
          }
          if (result.confidence === "high") highParsed++;
          if (result.terrainOffset !== null) terrainReached++;
          if (result.terrainPlausible) terrainPlausible++;
          if (result.objectsFullyParsed) objectsFullyParsed++;
          else if (result.objectsPartial) objectsPartial++;
          if (result.eventsSanityPassed) objectsEventsSane++;
          if (result.objectFailReason) {
            const m = result.objectFailReason.match(
              /unsupported object class (\d+)/
            );
            if (m) {
              unsupportedClasses.set(
                m[1],
                (unsupportedClasses.get(m[1]) ?? 0) + 1
              );
            }
          }

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
              } ${result.confidence} ${
                result.terrainOffset !== null ? `T@${result.terrainOffset}` : "T:miss"
              }${result.error ? ` (${result.error})` : ""}`
            );
          }
        })
      )
    );

    console.log(
      `\nTerrain reached:    ${terrainReached} / ${highParsed} high-parsed (${
        highParsed === 0 ? 0 : ((100 * terrainReached) / highParsed).toFixed(1)
      }%)`
    );
    console.log(
      `Terrain plausible:  ${terrainPlausible} / ${terrainReached} reached (${
        terrainReached === 0
          ? 0
          : ((100 * terrainPlausible) / terrainReached).toFixed(1)
      }%) — terrain ids all in known range`
    );
    console.log(
      `Objects fully:      ${objectsFullyParsed} / ${terrainReached} reached (${
        terrainReached === 0
          ? 0
          : ((100 * objectsFullyParsed) / terrainReached).toFixed(1)
      }%)`
    );
    console.log(
      `Objects partial:    ${objectsPartial} (walked some, then hit unsupported class)`
    );
    console.log(
      `Events-sane walks:  ${objectsEventsSane} / ${terrainReached} reached (${
        terrainReached === 0
          ? 0
          : ((100 * objectsEventsSane) / terrainReached).toFixed(1)
      }%) — cursor lands at plausible event count after objects`
    );
    if (unsupportedClasses.size > 0) {
      console.log(`\nTop unsupported object classes (extend objects.ts to lift):`);
      const top = [...unsupportedClasses.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      for (const [cls, n] of top) {
        console.log(`  class ${cls.padStart(3)} → ${n} maps blocked`);
      }
    }

    console.log(`\n=== By DB version (what we labeled the map) ===`);
    printTable(byDbVersion);

    console.log(`\n=== By parsed format (what the file actually is) ===`);
    printTable(byParsedFormat);

    if (victoryHistogram.size > 0) {
      console.log(`\n=== Victory conditions ===`);
      for (const [k, v] of [...victoryHistogram.entries()].sort(
        (a, b) => b[1] - a[1]
      )) {
        console.log(`  ${k.padEnd(22)} ${v}`);
      }
    }
    if (lossHistogram.size > 0) {
      console.log(`\n=== Loss conditions ===`);
      for (const [k, v] of [...lossHistogram.entries()].sort(
        (a, b) => b[1] - a[1]
      )) {
        console.log(`  ${k.padEnd(22)} ${v}`);
      }
    }
    if (playerCountHistogram.size > 0) {
      console.log(`\n=== Player counts ===`);
      for (const [k, v] of [...playerCountHistogram.entries()].sort(
        (a, b) => a[0] - b[0]
      )) {
        console.log(`  ${k} players: ${v}`);
      }
    }

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
  victoryType: string | null;
  lossType: string | null;
  totalPlayers: number | null;
  terrainOffset: number | null;
  terrainPlausible: boolean;
  objectsFullyParsed: boolean;
  objectsPartial: boolean;
  objectFailReason: string | null;
  eventsSanityPassed: boolean;
}> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        format: "Unknown",
        confidence: "failed",
        error: `HTTP ${res.status}`,
        victoryType: null,
        lossType: null,
        totalPlayers: null,
        terrainOffset: null,
        terrainPlausible: false,
        objectsFullyParsed: false,
        objectsPartial: false,
        objectFailReason: null,
        eventsSanityPassed: false,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const unwrapped = unwrapMapFile(buf);
    if (!unwrapped.ok) {
      return {
        format: "Unknown",
        confidence: "failed",
        error: unwrapped.reason,
        victoryType: null,
        lossType: null,
        totalPlayers: null,
        terrainOffset: null,
        terrainPlausible: false,
        objectsFullyParsed: false,
        objectsPartial: false,
        objectFailReason: null,
        eventsSanityPassed: false,
      };
    }
    const r = parseH3m(Buffer.from(unwrapped.bytes));
    const plausible =
      r.terrain !== null &&
      terrainPlausibility(r.terrain.surface) < 0.01 &&
      (r.terrain.underground === null ||
        terrainPlausibility(r.terrain.underground) < 0.01);
    const objectsFullyParsed =
      r.objects !== null && r.objects.failedAtInstance === undefined;
    const objectsPartial =
      r.objects !== null && r.objects.failedAtInstance !== undefined;
    return {
      format: r.format,
      confidence: r.confidence,
      error: r.error,
      victoryType: r.victory?.type ?? null,
      lossType: r.loss?.type ?? null,
      totalPlayers: r.totalPlayers,
      terrainOffset: r.terrainOffset,
      terrainPlausible: plausible,
      objectsFullyParsed,
      objectsPartial,
      objectFailReason: r.objects?.failedReason ?? null,
      eventsSanityPassed: r.objects?.passedEventSanityCheck ?? false,
    };
  } catch (e) {
    return {
      format: "Unknown",
      confidence: "failed",
      error: e instanceof Error ? e.message : String(e),
      victoryType: null,
      lossType: null,
      totalPlayers: null,
      terrainOffset: null,
      terrainPlausible: false,
      objectsFullyParsed: false,
      objectsPartial: false,
      objectFailReason: null,
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
