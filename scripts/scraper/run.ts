import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import {
  parseListingPage,
  parsePageCount,
  mapSize,
  mapDifficulty,
  mapVersion,
  slugify,
  parseAddedDate,
  type ScrapedMap,
} from "./parse";

const UA = "HeroicMaps-Scraper/0.1 (hobby; contact via github)";
const BASE = "https://www.maps4heroes.com/heroes3/maps.php";
const DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(limit: number, attempt = 1): Promise<string> {
  const url = `${BASE}?&limit=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    if (attempt < 3) {
      console.warn(`  [retry ${attempt}] ${url} -> ${res.status}`);
      await sleep(5000 * attempt);
      return fetchPage(limit, attempt + 1);
    }
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return res.text();
}

async function upsertMap(
  db: ReturnType<typeof drizzle>,
  m: ScrapedMap
): Promise<"inserted" | "updated" | "skipped"> {
  const size = mapSize(m.sizeRaw);
  const version = mapVersion(m.versionRaw);
  if (!size || !version) return "skipped";
  if (m.totalPlayers == null || m.humanPlayers == null) return "skipped";

  const slug = slugify(m.name, m.sourceId);
  const fileKey = `source:${m.sourceId}`; // placeholder until we fetch the .zip

  const result = await db.execute(sql`
    INSERT INTO maps (
      slug, name, description,
      size, version, difficulty,
      total_players, human_players, ai_players, team_count,
      has_underground,
      file_key, preview_key,
      source_url, download_count, source_rating,
      published_at
    ) VALUES (
      ${slug}, ${m.name}, ${m.description},
      ${size}, ${version}, ${mapDifficulty(m.difficultyRaw)},
      ${m.totalPlayers}, ${m.humanPlayers}, ${Math.max(0, m.totalPlayers - m.humanPlayers)}, ${m.teamCount},
      ${m.hasUnderground},
      ${fileKey}, ${m.previewUrl},
      ${m.sourceUrl}, ${m.downloadCount ?? 0}, ${m.ratingScore},
      ${parseAddedDate(m.addedRaw)?.toISOString() ?? null}
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      download_count = EXCLUDED.download_count,
      source_rating = EXCLUDED.source_rating,
      preview_key = EXCLUDED.preview_key,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `);
  const row = (result as unknown as { inserted: boolean }[])[0];
  return row?.inserted ? "inserted" : "updated";
}

async function main() {
  const startPage = parseInt(process.env.START_PAGE ?? "0", 10);
  const maxPagesEnv = process.env.MAX_PAGES;
  const dryRun = process.env.DRY_RUN === "1";

  const client = postgres(process.env.DATABASE_URL!, { max: 4 });
  const db = drizzle(client, { schema });

  console.log(`Fetching first listing page (limit=${startPage})...`);
  const firstHtml = await fetchPage(startPage);
  const totalPages = parsePageCount(firstHtml);
  const maxPages = maxPagesEnv ? parseInt(maxPagesEnv, 10) : totalPages;
  console.log(
    `Total pages on site: ${totalPages}. Will scrape ${maxPages} starting from ${startPage}.`
  );

  let inserted = 0,
    updated = 0,
    skipped = 0,
    failed = 0;

  for (let i = 0; i < maxPages; i++) {
    const limit = startPage + i;
    if (limit >= totalPages) break;

    const html = i === 0 ? firstHtml : await fetchPage(limit);
    const maps = parseListingPage(html);
    console.log(
      `[page ${limit + 1}/${totalPages}] parsed ${maps.length} maps`
    );

    if (!dryRun) {
      for (const m of maps) {
        try {
          const r = await upsertMap(db, m);
          if (r === "inserted") inserted++;
          else if (r === "updated") updated++;
          else skipped++;
        } catch (e) {
          failed++;
          const err = e as Error & { cause?: unknown; detail?: string };
          console.warn(
            `  ! ${m.sourceId} ${m.name}:`,
            err.message?.split("\n")[0],
            err.detail ?? "",
            err.cause ?? ""
          );
        }
      }
    }

    if (i < maxPages - 1) await sleep(DELAY_MS);
  }

  console.log(
    `\nDone. inserted=${inserted} updated=${updated} skipped=${skipped} failed=${failed}`
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
