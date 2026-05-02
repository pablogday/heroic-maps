/**
 * Re-scrape the maps4heroes.com listing pages and write the author
 * onto every matching maps row. The original scrape parsed authors
 * but discarded them (no schema column at the time).
 *
 *   npm exec tsx scripts/scraper-author-backfill.ts -- --dry --pages=2
 *   npm exec tsx scripts/scraper-author-backfill.ts
 *
 * Coverage limit: maps4heroes.com only exposes ~290 maps via this
 * listing today. Older scraped maps that aren't on the current
 * paginated list will keep `author = null`. Detail pages handle the
 * null gracefully (just don't render the "by …" line).
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { parseListingPage } from "./scraper/parse";

const BASE = "https://www.maps4heroes.com/heroes3/maps.php";
const UA = "HeroicMaps/0.1 (hobby; contact via heroicmaps.app)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Args = { dry: boolean; pages?: number; perPage: number; force: boolean };
function parseArgs(): Args {
  const a: Args = { dry: false, perPage: 10, force: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--force") a.force = true;
    else if (arg.startsWith("--pages=")) a.pages = Number(arg.slice(8));
    else if (arg.startsWith("--per-page=")) a.perPage = Number(arg.slice(11));
  }
  return a;
}

async function fetchPage(offset: number, perPage: number): Promise<string> {
  const url = `${BASE}?&limit=${offset}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.text();
    await sleep(2000 * attempt);
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function main() {
  const args = parseArgs();
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  try {
    // Build the set of source_ids we need authors for.
    const filter = args.force ? "TRUE" : "author IS NULL";
    const targets = (await sql.unsafe(
      `SELECT id, slug, source_url FROM maps WHERE ${filter} AND source_url LIKE '%map_id=%'`
    )) as Array<{ id: number; slug: string; source_url: string }>;
    const wantSourceIds = new Map<number, { id: number; slug: string }>();
    for (const t of targets) {
      const m = t.source_url.match(/map_id=(\d+)/);
      if (m) wantSourceIds.set(Number(m[1]), { id: t.id, slug: t.slug });
    }
    console.log(
      `${args.dry ? "[DRY] " : ""}Need authors for ${wantSourceIds.size} maps`
    );

    let written = 0;
    let pages = 0;
    let offset = 0;

    let consecutiveEmpty = 0;
    while (wantSourceIds.size > 0) {
      if (args.pages && pages >= args.pages) break;
      const html = await fetchPage(offset, args.perPage);
      const parsed = parseListingPage(html);
      pages++;
      if (parsed.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 5) break;
        offset += args.perPage;
        await sleep(2000);
        continue;
      }
      consecutiveEmpty = 0;

      let pageWrote = 0;
      for (const m of parsed) {
        const target = wantSourceIds.get(m.sourceId);
        if (!target) continue;
        if (m.author) {
          if (!args.dry) {
            await sql`UPDATE maps SET author = ${m.author} WHERE id = ${target.id}`;
          }
          written++;
          pageWrote++;
          wantSourceIds.delete(m.sourceId);
        }
      }

      console.log(
        `  page ${pages} (offset=${offset}): wrote ${pageWrote}, ${wantSourceIds.size} remaining`
      );

      offset += args.perPage;
      await sleep(2500); // polite
    }

    console.log(`\nWritten: ${written}`);
    console.log(`Still missing: ${wantSourceIds.size}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
