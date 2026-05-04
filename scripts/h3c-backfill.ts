/**
 * Detects every campaign-archive map in the corpus, parses it, and
 * writes the result to `maps.campaign_data`. Re-runnable: rows with
 * existing campaign_data are re-parsed (lets us reflect parser fixes).
 *
 *   npm exec tsx scripts/h3c-backfill.ts            # run for real
 *   npm exec tsx scripts/h3c-backfill.ts -- --dry  # print changes only
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { gunzipSync } from "fflate";
import { unwrapMapFile } from "../src/lib/h3m";
import { isCampaignMagic, parseH3c } from "../src/lib/h3c";

interface CampaignDataPayload {
  version: string;
  hotaFormatVersion: number | null;
  scenarioCount: number;
  scenarios: Array<{
    mapName: string;
    regionColor: number;
    difficulty: number;
    regionText: string;
    prologText: string;
    epilogText: string;
  }>;
  music: number;
  regionId: number;
  parserError: string | null;
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const sql = postgres(process.env.DATABASE_URL!, { max: 6 });
  try {
    const rows = (await sql`
      SELECT id, slug, version, file_key, campaign_data
      FROM maps
      WHERE file_key LIKE 'http%'
      ORDER BY id
    `) as Array<{
      id: number;
      slug: string;
      version: string;
      file_key: string;
      campaign_data: unknown;
    }>;

    console.log(`Scanning ${rows.length} maps for campaign archives…`);

    const updates: Array<{ id: number; data: CampaignDataPayload }> = [];
    const limiter = pLimit(8);
    let scanned = 0;
    let detected = 0;
    let parseErrors = 0;

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
            detected++;
            const result = parseH3c(raw);
            if (result.ok) {
              updates.push({
                id: row.id,
                data: {
                  version: result.version,
                  hotaFormatVersion: result.hotaFormatVersion,
                  scenarioCount: result.scenarios.length,
                  scenarios: result.scenarios.map((s) => ({
                    mapName: s.mapName,
                    regionColor: s.regionColor,
                    difficulty: s.difficulty,
                    regionText: s.regionText,
                    prologText: s.prologText,
                    epilogText: s.epilogText,
                  })),
                  music: result.music,
                  regionId: result.campaignRegionId,
                  parserError: null,
                },
              });
            } else {
              parseErrors++;
              updates.push({
                id: row.id,
                data: {
                  version: row.version,
                  hotaFormatVersion: null,
                  scenarioCount: 0,
                  scenarios: [],
                  music: 0,
                  regionId: 0,
                  parserError: result.error,
                },
              });
            }
          } catch (e) {
            // network or decode failure
            void e;
          }
        })
      )
    );

    console.log(
      `Scanned ${scanned}; detected ${detected} campaigns; parse errors ${parseErrors}; will write ${updates.length} rows.\n`
    );

    if (dryRun) {
      for (const u of updates.slice(0, 10)) {
        console.log(
          `  #${u.id.toString().padStart(4)}  v=${u.data.version.padEnd(4)}  n=${u.data.scenarioCount}  err=${u.data.parserError ?? "—"}`
        );
      }
      console.log(`\n(dry run — no DB writes)`);
      return;
    }

    let written = 0;
    for (const { id, data } of updates) {
      await sql`UPDATE maps SET campaign_data = ${sql.json({ ...data })} WHERE id = ${id}`;
      written++;
    }
    console.log(`Wrote campaign_data on ${written} rows.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
