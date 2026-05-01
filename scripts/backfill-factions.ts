/**
 * Best-effort faction inference from map descriptions.
 *
 * Scans each map's name + description for faction keywords and writes the
 * resulting list to `maps.factions`. Imperfect — a map called "Castle of
 * Bones" will get tagged Castle and Necropolis even if the towns aren't
 * actually those — but it's a useful starting point until we either:
 *   (a) parse the .h3m binary, or
 *   (b) run a Claude tagging pass over descriptions.
 *
 * Run: npx tsx scripts/backfill-factions.ts [--dry] [--limit=N] [--force]
 *   --dry    print what would change, don't write
 *   --force  overwrite existing factions arrays (default: only fill nulls)
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { inferFactionsFromText } from "../src/lib/factions";

type Args = { dry: boolean; force: boolean; limit?: number };
function parseArgs(): Args {
  const a: Args = { dry: false, force: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--force") a.force = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
  }
  return a;
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  const rows = await (args.limit
    ? sql<{ id: number; name: string; description: string | null }[]>`
        SELECT id, name, description
        FROM maps
        WHERE ${args.force ? sql`true` : sql`factions IS NULL`}
        ORDER BY id
        LIMIT ${args.limit}
      `
    : sql<{ id: number; name: string; description: string | null }[]>`
        SELECT id, name, description
        FROM maps
        WHERE ${args.force ? sql`true` : sql`factions IS NULL`}
        ORDER BY id
      `);

  console.log(`Scanning ${rows.length} map(s)…`);

  let updated = 0;
  let empty = 0;
  for (const m of rows) {
    const factions = inferFactionsFromText(`${m.name}\n${m.description ?? ""}`);
    if (factions.length === 0) {
      empty++;
      if (args.dry) console.log(`  [${m.id}] ${m.name} → (none)`);
      continue;
    }
    if (args.dry) {
      console.log(`  [${m.id}] ${m.name} → ${factions.join(", ")}`);
      continue;
    }
    await sql`
      UPDATE maps SET factions = ${factions}, updated_at = now()
      WHERE id = ${m.id}
    `;
    updated++;
  }

  console.log(
    args.dry
      ? `(dry run) would tag ${rows.length - empty} map(s); ${empty} would stay empty.`
      : `Tagged ${updated} map(s); ${empty} had no recognizable keywords.`
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
