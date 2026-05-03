/**
 * Walk a single map's object instances one-by-one, logging the
 * cursor position + byte count before/after each. When the walk
 * fails, the LAST successful instance's class is the suspect — its
 * body parser consumed the wrong number of bytes.
 *
 *   npm exec tsx scripts/h3m-objects-trace.ts -- --slug=<slug> [--first=N]
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { gunzipSync } from "fflate";
import { unwrapMapFile, parseH3m, objectClassName } from "../src/lib/h3m";
import { BinaryReader } from "../src/lib/h3m/reader";
import { VERSION_MAGIC, type FormatId } from "../src/lib/h3m/versions";
import { parseBasicHeader } from "../src/lib/h3m/header";
import { parsePlayers } from "../src/lib/h3m/playerInfo";
import { parseVictory, parseLoss } from "../src/lib/h3m/conditions";
import { parseHotaPrefix } from "../src/lib/h3m/hota";
import { walkToTerrain } from "../src/lib/h3m/worldData";
import { parseTerrain } from "../src/lib/h3m/terrain";
import { featuresFor } from "../src/lib/h3m/objects";

const HOTA: ReadonlySet<FormatId> = new Set<FormatId>([
  "HotA1",
  "HotA2",
  "HotA3",
]);

async function main() {
  const slug = process.argv
    .find((a) => a.startsWith("--slug="))
    ?.slice(7);
  const firstArg = process.argv
    .find((a) => a.startsWith("--first="))
    ?.slice(8);
  const showAll = !firstArg;
  const first = firstArg ? Number(firstArg) : 0;

  if (!slug) {
    console.error("usage: h3m-objects-trace.ts --slug=<slug> [--first=N]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [m] = (await sql`SELECT slug, file_key FROM maps WHERE slug = ${slug}`) as Array<{
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
    const u = unwrapMapFile(archive);
    if (!u.ok) {
      console.error(u.reason);
      process.exit(1);
    }
    const raw =
      u.bytes[0] === 0x1f && u.bytes[1] === 0x8b ? gunzipSync(u.bytes) : u.bytes;

    // Re-parse from scratch so we can intercept the object loop.
    const reader = new BinaryReader(raw);
    const versionMagic = reader.u32le();
    const format = VERSION_MAGIC[versionMagic] ?? "Unknown";
    let hotaSubRev: number | null = null;
    if (HOTA.has(format)) hotaSubRev = parseHotaPrefix(reader).subRevision;
    const headerFormat = HOTA.has(format) || format === "WoG" ? "SoD" : format;
    const hdr = parseBasicHeader(
      reader,
      headerFormat as "RoE" | "AB" | "SoD"
    );
    parsePlayers(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseVictory(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseLoss(reader);
    walkToTerrain(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseTerrain(reader, hdr.width, hdr.width, hdr.hasUnderground);

    const features = featuresFor(format, hotaSubRev);
    void features;

    // Now parse object templates inline.
    const tCount = reader.u32le();
    const templates: { sprite: string; objClass: number; objSubclass: number }[] = [];
    for (let i = 0; i < tCount; i++) {
      const sprite = reader.string();
      reader.skip(6 + 6 + 2 + 2);
      const objClass = reader.u32le();
      const objSubclass = reader.u32le();
      reader.skip(1 + 1 + 16);
      templates.push({ sprite, objClass, objSubclass });
    }
    console.log(`format=${format}, ${templates.length} templates`);

    // Use parseH3m's object body parser for one instance at a time so
    // the trace stays in sync with production behavior. We invoke
    // parseObjects with a shrunk buffer? Easier: fall back to manually
    // calling the dispatcher. For now, parse via parseH3m and grab
    // the failure site from its result.
    //
    // Actually simplest: let parseH3m produce its instance list +
    // failedAtInstance pointer, then re-walk to that point manually
    // using parseInstance to dump per-instance details.
    const r = parseH3m(u.bytes);
    const objs = r.objects;
    if (!objs) {
      console.error("no objects parsed");
      process.exit(1);
    }
    console.log(
      `parsed ${objs.instances.length} instances; failedAt=${objs.failedAtInstance ?? "(none)"}; reason=${objs.failedReason ?? "—"}`
    );
    console.log(
      `events sanity: ${objs.passedEventSanityCheck ? "PASSED" : "FAILED"}`
    );
    if (showAll || first) {
      const slice = objs.instances.slice(0, first || objs.instances.length);
      const counts = new Map<number, number>();
      for (const ins of slice) {
        counts.set(ins.objClass, (counts.get(ins.objClass) ?? 0) + 1);
      }
      console.log("\nInstance class histogram (first slice):");
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      for (const [cls, n] of sorted.slice(0, 20)) {
        console.log(`  ${cls.toString().padStart(4)} ${objectClassName(cls).padEnd(28)} ${n}`);
      }
    }

    if (objs.failedAtInstance !== undefined) {
      const lastOk = objs.instances.length;
      console.log(`\nLast 5 successfully parsed instances:`);
      for (const ins of objs.instances.slice(Math.max(0, lastOk - 5))) {
        const tmpl = templates[ins.templateIndex];
        console.log(
          `  pos=(${ins.x},${ins.y},${ins.z}) class=${ins.objClass} ${objectClassName(ins.objClass)} sprite=${tmpl?.sprite ?? "?"}`
        );
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
