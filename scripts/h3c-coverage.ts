/**
 * Run the campaign parser against every campaign-archive map in the
 * corpus. Reports parse rate, version distribution, and scenario
 * count distribution.
 *
 *   npm exec tsx scripts/h3c-coverage.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { gunzipSync } from "fflate";
import { unwrapMapFile } from "../src/lib/h3m";
import { isCampaignMagic, parseH3c } from "../src/lib/h3c";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 6 });
  try {
    const rows = (await sql`
      SELECT id, slug, version, file_key
      FROM maps
      WHERE file_key LIKE 'http%'
      ORDER BY id
    `) as Array<{ id: number; slug: string; version: string; file_key: string }>;

    let scanned = 0;
    let totalCampaigns = 0;
    let parsedOk = 0;
    let parsedFailed = 0;
    const byVersion = new Map<string, { ok: number; fail: number }>();
    const failureReasons = new Map<string, number>();
    const scenarioCounts = new Map<number, number>();
    const samples: Array<{
      slug: string;
      version: string;
      name: string;
      n: number;
      first: string;
    }> = [];

    const limiter = pLimit(8);
    await Promise.all(
      rows.map((row) =>
        limiter(async () => {
          try {
            const buf = new Uint8Array(
              await (await fetch(row.file_key)).arrayBuffer()
            );
            const u = unwrapMapFile(buf);
            if (!u.ok) return;
            const raw =
              u.bytes[0] === 0x1f && u.bytes[1] === 0x8b
                ? gunzipSync(u.bytes)
                : u.bytes;
            scanned++;
            if (!isCampaignMagic(raw)) return;
            totalCampaigns++;
            const result = parseH3c(raw);
            const bucket =
              byVersion.get(row.version) ?? { ok: 0, fail: 0 };
            byVersion.set(row.version, bucket);
            if (result.ok) {
              parsedOk++;
              bucket.ok++;
              const n = result.scenarios.length;
              scenarioCounts.set(n, (scenarioCounts.get(n) ?? 0) + 1);
              if (samples.length < 8) {
                samples.push({
                  slug: row.slug,
                  version: result.version,
                  name: result.name,
                  n,
                  first: result.scenarios[0]?.mapName ?? "(none)",
                });
              }
            } else {
              parsedFailed++;
              bucket.fail++;
              failureReasons.set(
                result.error.slice(0, 60),
                (failureReasons.get(result.error.slice(0, 60)) ?? 0) + 1
              );
            }
          } catch {
            // ignore individual fetch errors
          }
        })
      )
    );

    console.log(`Scanned ${scanned} maps; ${totalCampaigns} were campaigns.`);
    console.log(`  parsed:  ${parsedOk}/${totalCampaigns} (${pct(parsedOk, totalCampaigns)}%)`);
    console.log(`  failed:  ${parsedFailed}/${totalCampaigns}`);

    console.log(`\nBy DB version:`);
    for (const [v, b] of byVersion) {
      console.log(
        `  ${v.padEnd(10)} ok=${b.ok.toString().padStart(3)} fail=${b.fail.toString().padStart(3)}`
      );
    }

    console.log(`\nScenario counts:`);
    const sortedCounts = [...scenarioCounts.entries()].sort((a, b) => a[0] - b[0]);
    for (const [n, c] of sortedCounts) {
      console.log(`  ${n.toString().padStart(3)} scenarios: ${c} campaigns`);
    }

    if (failureReasons.size > 0) {
      console.log(`\nFailure reasons:`);
      const sorted = [...failureReasons.entries()].sort(
        (a, b) => b[1] - a[1]
      );
      for (const [reason, n] of sorted) {
        console.log(`  ${n.toString().padStart(3)}  ${reason}`);
      }
    }

    if (samples.length > 0) {
      console.log(`\nSamples:`);
      for (const s of samples) {
        console.log(
          `  ${s.slug.padEnd(48)} v=${s.version.padEnd(4)} n=${s.n} first="${s.first}" — ${s.name}`
        );
      }
    }
  } finally {
    await sql.end();
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return "0";
  return ((100 * n) / total).toFixed(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
