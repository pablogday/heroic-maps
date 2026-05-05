/**
 * Find every object instance of a given class across the corpus and
 * print the next ~40 bytes after the instance header. Lets us
 * pattern-match a class's body structure across many maps.
 *
 *   npm exec tsx scripts/h3m-class-probe.ts -- --class=134
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import { gunzipSync } from "fflate";
import { unwrapMapFile, parseH3m } from "../src/lib/h3m";
import { BinaryReader } from "../src/lib/h3m/reader";
import { VERSION_MAGIC, type FormatId } from "../src/lib/h3m/versions";
import { parseBasicHeader } from "../src/lib/h3m/header";
import { parsePlayers } from "../src/lib/h3m/playerInfo";
import { parseVictory, parseLoss } from "../src/lib/h3m/conditions";
import { parseHotaPrefix } from "../src/lib/h3m/hota";
import { walkToTerrain } from "../src/lib/h3m/worldData";
import { parseTerrain } from "../src/lib/h3m/terrain";

const HOTA: ReadonlySet<FormatId> = new Set<FormatId>(["HotA1", "HotA2", "HotA3"]);

async function main() {
  const targetClass = Number(
    process.argv.find((a) => a.startsWith("--class="))?.slice(8)
  );
  const limit = Number(
    process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? "10"
  );
  if (!targetClass) {
    console.error("usage: h3m-class-probe.ts --class=N [--limit=10]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  try {
    const rows = (await sql`
      SELECT id, slug, file_key
      FROM maps
      WHERE file_key LIKE 'http%' AND version = 'SoD'
      ORDER BY id
      LIMIT 1500
    `) as Array<{ id: number; slug: string; file_key: string }>;

    let found = 0;
    const limiter = pLimit(6);
    await Promise.all(
      rows.map((row) =>
        limiter(async () => {
          if (found >= limit) return;
          const sample = await probe(row, targetClass);
          if (sample && found < limit) {
            found++;
            console.log(`#${row.id} ${row.slug}`);
            console.log(
              `  template: class=${sample.objClass}, sprite="${sample.sprite}"`
            );
            console.log(`  pos: (${sample.x}, ${sample.y}, ${sample.z})`);
            console.log(`  next 48 bytes after header:`);
            console.log(`  ${sample.hex}`);
            console.log();
          }
        })
      )
    );
  } finally {
    await sql.end();
  }
}

async function probe(
  row: { file_key: string },
  targetClass: number
): Promise<{
  objClass: number;
  sprite: string;
  x: number;
  y: number;
  z: number;
  hex: string;
} | null> {
  try {
    const archive = new Uint8Array(
      await (await fetch(row.file_key)).arrayBuffer()
    );
    const unwrapped = await unwrapMapFile(archive);
    if (!unwrapped.ok) return null;
    const raw =
      unwrapped.bytes[0] === 0x1f && unwrapped.bytes[1] === 0x8b
        ? gunzipSync(unwrapped.bytes)
        : unwrapped.bytes;

    // Cheap path: use parseH3m to get terrain offset, then walk to objects ourselves.
    const r = parseH3m(unwrapped.bytes);
    if (!r.terrain || !r.terrainOffset) return null;

    // Re-walk to terrain to get a positioned cursor (parseH3m consumed
    // its own buffer; we need a fresh reader).
    const reader = new BinaryReader(raw);
    reader.u32le(); // version
    const format = VERSION_MAGIC[r.versionMagic] ?? "SoD";
    if (HOTA.has(format)) parseHotaPrefix(reader);
    const headerFormat = HOTA.has(format) || format === "WoG" ? "SoD" : format;
    const hdr = parseBasicHeader(reader, headerFormat as "RoE" | "AB" | "SoD");
    parsePlayers(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseVictory(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseLoss(reader);
    walkToTerrain(
      reader,
      (await import("../src/lib/h3m/objects")).featuresFor(format, null)
    );
    parseTerrain(reader, hdr.width, hdr.width, hdr.hasUnderground);

    // Now at objects. Parse templates.
    const templateCount = reader.u32le();
    const templates: { sprite: string; objClass: number }[] = [];
    for (let i = 0; i < templateCount; i++) {
      const sprite = reader.string();
      reader.skip(6 + 6 + 2 + 2);
      const objClass = reader.u32le();
      reader.u32le(); // subClass
      reader.skip(1 + 1 + 16);
      templates.push({ sprite, objClass });
    }

    // Iterate instances.
    const instanceCount = reader.u32le();
    for (let i = 0; i < instanceCount; i++) {
      const x = reader.u8();
      const y = reader.u8();
      const z = reader.u8();
      const ti = reader.u32le();
      reader.skip(5);
      const tmpl = templates[ti];
      if (!tmpl) return null;
      if (tmpl.objClass === targetClass) {
        const peek = reader.buf.subarray(reader.offset, reader.offset + 48);
        const hex = [...peek]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");
        return { objClass: tmpl.objClass, sprite: tmpl.sprite, x, y, z, hex };
      }
      // Bail — to avoid mis-walking when we don't know the body shape.
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
