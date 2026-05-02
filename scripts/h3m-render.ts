/**
 * Render a single map's minimap to a PNG on disk. Use to eyeball
 * parser + renderer output against the maps4heroes.com preview for
 * the same map.
 *
 *   npm exec tsx scripts/h3m-render.ts <slug-or-id> [--tile=4] [--out=path]
 *
 * Default output: backups/minimaps/<slug>.png
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import sharp from "sharp";
import { parseH3m, unwrapMapFile, renderMinimap } from "../src/lib/h3m";

async function main() {
  const args = process.argv.slice(2);
  let target: { slug?: string; id?: number } = {};
  let tileSize = 4;
  let outPath: string | null = null;
  let bothLevels = true;
  for (const a of args) {
    if (a.startsWith("--tile=")) tileSize = Number(a.slice(7));
    else if (a.startsWith("--out=")) outPath = a.slice(6);
    else if (a === "--surface-only") bothLevels = false;
    else if (a.startsWith("--id=")) target.id = Number(a.slice(5));
    else if (!a.startsWith("--")) target.slug = a;
  }
  if (!target.slug && !target.id) {
    console.error("usage: h3m-render.ts <slug> | --id=<n> [--tile=N] [--out=path]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  try {
    const where = target.id
      ? sql`id = ${target.id}`
      : sql`slug = ${target.slug!}`;
    const rows = (await sql`
      SELECT id, slug, name, file_key
      FROM maps WHERE ${where} LIMIT 1
    `) as Array<{ id: number; slug: string; name: string; file_key: string }>;
    if (rows.length === 0) {
      console.error("no map matched");
      process.exit(1);
    }
    const m = rows[0];
    console.log(`Map: ${m.name} (#${m.id} ${m.slug})`);

    const archive = new Uint8Array(
      await (await fetch(m.file_key)).arrayBuffer()
    );
    const unwrapped = unwrapMapFile(archive);
    if (!unwrapped.ok) {
      console.error(`unwrap failed: ${unwrapped.reason}`);
      process.exit(1);
    }
    const parsed = parseH3m(unwrapped.bytes);
    if (!parsed.terrain) {
      console.error(
        `terrain not parsed (confidence=${parsed.confidence}, error=${parsed.error ?? "—"})`
      );
      process.exit(1);
    }

    const img = renderMinimap(parsed.terrain, { tileSize, bothLevels });
    console.log(
      `rendered ${img.width}×${img.height}px (tile=${tileSize}, ${
        parsed.terrain.hasUnderground && bothLevels ? "both levels" : "surface"
      })`
    );

    const png = await sharp(Buffer.from(img.pixels.buffer), {
      raw: { width: img.width, height: img.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const path =
      outPath ?? `backups/minimaps/${m.slug}.png`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, png);
    console.log(`wrote ${path} (${png.length} bytes)`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
