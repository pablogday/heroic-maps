/**
 * For every map whose .h3m we can fully parse the object layer of,
 * categorize the objects and write the stats jsonb. Skips maps where
 * the walk failed (object_stats stays null — UI shows nothing).
 *
 *   npm exec tsx scripts/h3m-stats-backfill.ts -- --dry
 *   npm exec tsx scripts/h3m-stats-backfill.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { parseH3m, unwrapMapFile, summarizeObjects } from "../src/lib/h3m";

type Args = { dry: boolean; limit?: number; concurrency: number };
function parseArgs(): Args {
  const a: Args = { dry: false, concurrency: 6 };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(16, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

async function main() {
  const args = parseArgs();
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  try {
    const limitClause = args.limit ? `LIMIT ${args.limit}` : "";
    const rows = (await sql.unsafe(
      `SELECT id, slug, file_key
       FROM maps
       WHERE file_key LIKE 'http%' AND object_stats IS NULL
       ORDER BY id ${limitClause}`
    )) as Array<{ id: number; slug: string; file_key: string }>;

    console.log(
      `${args.dry ? "[DRY] " : ""}Backfilling object_stats for ${rows.length} maps`
    );

    let written = 0;
    let skippedUnparseable = 0;
    let skippedPartialObjects = 0;
    let processed = 0;

    const limit = pLimit(args.concurrency);
    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          processed++;
          if (processed % 200 === 0) console.log(`  …${processed}/${rows.length}`);
          try {
            const archive = new Uint8Array(
              await (await fetch(row.file_key)).arrayBuffer()
            );
            const u = unwrapMapFile(archive);
            if (!u.ok) {
              skippedUnparseable++;
              return;
            }
            const r = parseH3m(u.bytes);
            if (
              !r.objects ||
              r.objects.failedAtInstance !== undefined ||
              !r.objects.passedEventSanityCheck
            ) {
              skippedPartialObjects++;
              return;
            }
            const stats = summarizeObjects(r.objects.instances);
            if (!args.dry) {
              await sql`UPDATE maps SET object_stats = ${sql.json({ ...stats })} WHERE id = ${row.id}`;
            }
            written++;
          } catch {
            skippedUnparseable++;
          }
        })
      )
    );

    console.log(`\nWritten:               ${written}`);
    console.log(`Skipped (unparseable): ${skippedUnparseable}`);
    console.log(`Skipped (partial obj): ${skippedPartialObjects}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
