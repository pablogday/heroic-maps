/**
 * Inspect where walkToTerrain lands for a single map.
 *
 *   npm exec tsx scripts/h3m-walk-trace.ts --id=39
 *
 * Re-parses everything up through win/loss conditions using the real
 * parser, then runs walkToTerrain with section-level tracing so we
 * can pinpoint the section that misaligns the cursor.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { gunzipSync } from "fflate";
import { unwrapMapFile } from "../src/lib/h3m";
import { BinaryReader } from "../src/lib/h3m/reader";
import { VERSION_MAGIC, type FormatId } from "../src/lib/h3m/versions";
import { parseBasicHeader } from "../src/lib/h3m/header";
import { parsePlayers } from "../src/lib/h3m/playerInfo";
import { parseVictory, parseLoss } from "../src/lib/h3m/conditions";
import { parseHotaPrefix } from "../src/lib/h3m/hota";
import { walkToTerrain, type WalkTrace } from "../src/lib/h3m/worldData";
import { featuresFor } from "../src/lib/h3m/objects";

const HOTA: ReadonlySet<FormatId> = new Set<FormatId>(["HotA1", "HotA2", "HotA3"]);

async function main() {
  const id = Number(process.argv.find((a) => a.startsWith("--id="))?.slice(5));
  if (!id) {
    console.error("usage: h3m-walk-trace.ts --id=<n>");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  try {
    const [m] = (await sql`SELECT slug, file_key FROM maps WHERE id = ${id}`) as Array<{
      slug: string;
      file_key: string;
    }>;
    if (!m) {
      console.error("not found");
      process.exit(1);
    }

    const archive = new Uint8Array(
      await (await fetch(m.file_key)).arrayBuffer()
    );
    const unwrapped = await unwrapMapFile(archive);
    if (!unwrapped.ok) {
      console.error(unwrapped.reason);
      process.exit(1);
    }
    const raw =
      unwrapped.bytes[0] === 0x1f && unwrapped.bytes[1] === 0x8b
        ? gunzipSync(unwrapped.bytes)
        : unwrapped.bytes;

    const reader = new BinaryReader(raw);
    const versionMagic = reader.u32le();
    const format = VERSION_MAGIC[versionMagic] ?? "Unknown";
    const isHota = HOTA.has(format);
    let hotaSubRev: number | null = null;
    if (isHota) hotaSubRev = parseHotaPrefix(reader).subRevision;

    const headerFormat = isHota || format === "WoG" ? "SoD" : format;
    const header = parseBasicHeader(reader, headerFormat as "RoE" | "AB" | "SoD");
    parsePlayers(reader, headerFormat as "RoE" | "AB" | "SoD");
    const v = parseVictory(reader, headerFormat as "RoE" | "AB" | "SoD");
    const l = parseLoss(reader);

    console.log(`map: ${m.slug}`);
    console.log(
      `  format: ${format} (header treated as ${headerFormat})${
        hotaSubRev !== null ? ` hotaSubRev=${hotaSubRev}` : ""
      }`
    );
    console.log(`  size: ${header.size} (${header.width}px), underground: ${header.hasUnderground}`);
    console.log(`  victory: ${v.type} — ${v.description}`);
    console.log(`  loss:    ${l.type} — ${l.description}`);
    console.log(`  cursor at byte ${reader.offset} after conditions\n`);

    const features = featuresFor(format, hotaSubRev);
    const trace: WalkTrace = [];
    try {
      walkToTerrain(reader, features, trace);
    } catch (e) {
      console.log(`walkToTerrain THREW: ${e instanceof Error ? e.message : String(e)}\n`);
    }

    console.log("Sections:");
    for (const s of trace) {
      const consumed = s.endOffset - s.startOffset;
      console.log(
        `  ${s.section.padEnd(24)} @${s.startOffset.toString().padStart(7)} +${consumed.toString().padStart(6)}b ${s.detail ?? ""}`
      );
    }
    console.log(`\n  cursor lands at: ${reader.offset} / file size ${raw.length}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
