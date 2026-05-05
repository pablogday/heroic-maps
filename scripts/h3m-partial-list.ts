/**
 * Quick scan: list every map that walks partially through objects, with
 * its failure reason and the LAST class successfully parsed before
 * failure. Histogram of last classes points at the body parser that's
 * off by N bytes.
 *
 *   npm exec tsx scripts/h3m-partial-list.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { unwrapMapFile, parseH3m, objectClassName } from "../src/lib/h3m";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 6 });
  try {
    const rows = (await sql`
      SELECT id, slug, file_key, version
      FROM maps
      WHERE file_key LIKE 'http%'
      ORDER BY id
    `) as Array<{ id: number; slug: string; file_key: string; version: string }>;

    const lastClassCount = new Map<number, number>();
    const reasonCount = new Map<string, number>();
    const samplesByClass = new Map<number, string[]>();

    const limiter = pLimit(8);
    let scanned = 0;
    let partial = 0;

    await Promise.all(
      rows.map((row) =>
        limiter(async () => {
          try {
            const buf = new Uint8Array(
              await (await fetch(row.file_key)).arrayBuffer()
            );
            const u = await unwrapMapFile(buf);
            if (!u.ok) return;
            const r = parseH3m(u.bytes);
            scanned++;
            if (!r.objects || r.objects.failedAtInstance === undefined) return;
            partial++;
            const lastIdx = r.objects.instances.length - 1;
            const last = r.objects.instances[lastIdx];
            const cls = last?.objClass ?? -1;
            lastClassCount.set(cls, (lastClassCount.get(cls) ?? 0) + 1);
            const reason = r.objects.failedReason ?? "(none)";
            reasonCount.set(reason.slice(0, 80), (reasonCount.get(reason.slice(0, 80)) ?? 0) + 1);
            const samples = samplesByClass.get(cls) ?? [];
            if (samples.length < 3) {
              samples.push(`#${row.id} ${row.slug}`);
              samplesByClass.set(cls, samples);
            }
          } catch {
            // ignore
          }
        })
      )
    );

    console.log(`Scanned ${scanned} maps, ${partial} partial walks.\n`);

    console.log("Last successful class before failure (top 25):");
    const sorted = [...lastClassCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cls, n] of sorted.slice(0, 25)) {
      const name = cls === -1 ? "<no-instances>" : objectClassName(cls);
      const samples = (samplesByClass.get(cls) ?? []).join(", ");
      console.log(`  ${cls.toString().padStart(4)} ${name.padEnd(28)} ${n.toString().padStart(3)}   ${samples}`);
    }

    console.log("\nFailure reasons:");
    const reasons = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, n] of reasons.slice(0, 15)) {
      console.log(`  ${n.toString().padStart(3)}  ${reason}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
