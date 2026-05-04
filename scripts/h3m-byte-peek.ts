/**
 * For a slug, parse up to the failing instance, then dump the bytes
 * starting at the last successful instance's body. Lets us reverse-
 * engineer what those bytes mean.
 *
 *   npm exec tsx scripts/h3m-byte-peek.ts -- --slug=<slug> [--bytes=80]
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
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
import { featuresFor } from "../src/lib/h3m/objects";

const HOTA: ReadonlySet<FormatId> = new Set<FormatId>(["HotA1", "HotA2", "HotA3"]);

async function main() {
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
  const peekBytes = Number(
    process.argv.find((a) => a.startsWith("--bytes="))?.slice(8) ?? "80"
  );
  const skipObjs = Number(
    process.argv.find((a) => a.startsWith("--skip="))?.slice(7) ?? "0"
  );
  if (!slug) {
    console.error("usage: h3m-byte-peek.ts --slug=<slug> [--bytes=80] [--skip=N]");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [m] = (await sql`SELECT slug, file_key FROM maps WHERE slug = ${slug}`) as Array<{
      slug: string;
      file_key: string;
    }>;
    if (!m) { console.error("not found"); process.exit(1); }
    const archive = new Uint8Array(await (await fetch(m.file_key)).arrayBuffer());
    const u = unwrapMapFile(archive);
    if (!u.ok) { console.error(u.reason); process.exit(1); }
    const raw = u.bytes[0] === 0x1f && u.bytes[1] === 0x8b ? gunzipSync(u.bytes) : u.bytes;

    const r = parseH3m(u.bytes);
    if (!r.objects) { console.error("no objects parsed"); process.exit(1); }

    // Walk fresh to get to the failing offset.
    const reader = new BinaryReader(raw);
    const versionMagic = reader.u32le();
    const format = VERSION_MAGIC[versionMagic] ?? "Unknown";
    let hotaSubRev: number | null = null;
    if (HOTA.has(format)) hotaSubRev = parseHotaPrefix(reader).subRevision;
    const headerFormat = HOTA.has(format) || format === "WoG" ? "SoD" : format;
    const hdr = parseBasicHeader(reader, headerFormat as "RoE" | "AB" | "SoD");
    parsePlayers(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseVictory(reader, headerFormat as "RoE" | "AB" | "SoD");
    parseLoss(reader);
    walkToTerrain(reader, featuresFor(format, hotaSubRev));
    parseTerrain(reader, hdr.width, hdr.width, hdr.hasUnderground);

    void skipObjs;
    console.log(`Format: ${format}, hotaSubRev=${hotaSubRev}`);
    console.log(`r.objects: parsed ${r.objects.instances.length}, failedAt=${r.objects.failedAtInstance}, reason=${r.objects.failedReason}\n`);

    const features = featuresFor(format, hotaSubRev);
    const parseObjectsModule = await import("../src/lib/h3m/objects");
    const out = parseObjectsModule.parseObjects(reader, features);
    const stoppedAt = out.failedAtInstance ?? out.instances.length;
    console.log(`Re-walked to instance ${stoppedAt}; cursor at ${reader.offset}`);
    if (stoppedAt > 0) {
      const last = out.instances[stoppedAt - 1];
      console.log(`Last good: pos=(${last.x},${last.y},${last.z}) class=${last.objClass} tmpl=${last.templateIndex}`);
    }

    const off = reader.offset;
    const peek = raw.subarray(Math.max(0, off - peekBytes), off + peekBytes);
    console.log(`\nBytes around offset ${off} (- ${peekBytes} ... + ${peekBytes}):`);
    const hex = [...peek].map((b, i) => {
      const isPivot = i === peekBytes;
      const s = b.toString(16).padStart(2, "0");
      return isPivot ? `[${s}]` : s;
    }).join(" ");
    console.log(hex);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
