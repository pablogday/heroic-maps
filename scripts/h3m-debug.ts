/**
 * Hex-dump the leading bytes of a single map file from R2 + run our
 * parser on it. Useful for reverse-engineering format extensions
 * (HotA, WoG, etc.) before we write proper parser code.
 *
 *   npm exec tsx scripts/h3m-debug.ts <slug>
 *   npm exec tsx scripts/h3m-debug.ts <slug> --bytes=400
 *   npm exec tsx scripts/h3m-debug.ts --id=271
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { parseH3m, unwrapMapFile } from "../src/lib/h3m";

async function main() {
  const args = process.argv.slice(2);
  let target: { slug?: string; id?: number } = {};
  let dumpBytes = 200;
  for (const a of args) {
    if (a.startsWith("--bytes=")) dumpBytes = Number(a.slice(8));
    else if (a.startsWith("--id=")) target.id = Number(a.slice(5));
    else if (!a.startsWith("--")) target.slug = a;
  }
  if (!target.slug && !target.id) {
    console.error("usage: h3m-debug.ts <slug> | --id=<n> [--bytes=<n>]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  try {
    const where = target.id
      ? sql`id = ${target.id}`
      : sql`slug = ${target.slug!}`;
    const rows = (await sql`
      SELECT id, slug, name, version, file_key, size, total_players,
             human_players, ai_players, difficulty, has_underground
      FROM maps
      WHERE ${where}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      console.error("no map matched");
      process.exit(1);
    }
    const m = rows[0];
    console.log("DB metadata:");
    for (const [k, v] of Object.entries(m)) {
      if (k === "file_key") continue;
      console.log(`  ${k.padEnd(18)} ${v}`);
    }
    console.log();

    const res = await fetch(m.file_key as string);
    const archive = new Uint8Array(await res.arrayBuffer());
    const unwrapped = unwrapMapFile(archive);
    if (!unwrapped.ok) {
      console.error(`unwrap failed: ${unwrapped.reason}`);
      process.exit(1);
    }
    const inner = unwrapped.bytes;
    console.log(
      `archive: ${archive.length} bytes; inner ${unwrapped.filename}: ${inner.length} bytes`
    );

    // gunzip
    const { gunzipSync } = await import("fflate");
    let raw: Uint8Array;
    if (inner[0] === 0x1f && inner[1] === 0x8b) {
      raw = gunzipSync(inner);
      console.log(`gunzipped: ${raw.length} bytes`);
    } else {
      raw = inner;
      console.log("(not gzipped)");
    }

    console.log();
    console.log(`First ${dumpBytes} bytes:`);
    hexDump(raw.subarray(0, dumpBytes));

    console.log();
    console.log("parser result:");
    const parsed = parseH3m(raw);
    console.log(`  format       ${parsed.format}`);
    console.log(`  versionMagic 0x${parsed.versionMagic.toString(16).padStart(8, "0")}`);
    console.log(`  confidence   ${parsed.confidence}`);
    if (parsed.error) console.log(`  error        ${parsed.error}`);
    if (parsed.warnings.length) console.log(`  warnings     ${parsed.warnings.join("; ")}`);
    if (parsed.header) {
      console.log(`  size         ${parsed.header.size} (${parsed.header.width}px)`);
      console.log(`  underground  ${parsed.header.hasUnderground}`);
      console.log(`  name         ${JSON.stringify(parsed.header.name)}`);
      console.log(`  difficulty   ${parsed.header.difficulty}`);
      console.log(`  description  ${parsed.header.description.slice(0, 60)}…`);
    }
    if (parsed.totalPlayers !== null) {
      console.log(
        `  players      ${parsed.totalPlayers} total / ${parsed.humanPlayers}H ${parsed.aiPlayers}AI`
      );
    }
    if (parsed.factions) console.log(`  factions     ${parsed.factions.join(", ")}`);
    if (parsed.victory) console.log(`  victory      ${parsed.victory.description}`);
    if (parsed.loss) console.log(`  loss         ${parsed.loss.description}`);
  } finally {
    await sql.end();
  }
}

function hexDump(buf: Uint8Array) {
  for (let i = 0; i < buf.length; i += 16) {
    const chunk = buf.subarray(i, Math.min(i + 16, buf.length));
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...chunk]
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    console.log(`  ${i.toString(16).padStart(4, "0")}  ${hex.padEnd(48)}  ${ascii}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
