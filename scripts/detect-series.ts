/**
 * Heuristic series detection. Groups maps whose names share a stem
 * after stripping common "this is part of a set" suffixes:
 *
 *   - " (E)", " (N)", " (H)", " (I)" — difficulty variants
 *   - trailing Roman numerals (II, III, IV, …)
 *   - trailing arabic digits (2, 3, 4, …)
 *   - " 2.0" / " v2" version suffixes
 *   - " -Era Edition", " (Era Edition)" remake tags
 *
 * Conservative on purpose: tries hard NOT to invent false series.
 *
 *   --dry        print what would change, don't write
 *   --min=N      minimum cluster size to record as a series (default 2)
 *   --kind=K     restrict to one kind (sequel|variant|remake)
 *   --reset      clear all existing series_id assignments first (drops
 *                heuristic detections only — manual edits would be too)
 *
 * Run twice: once with --dry to eyeball clusters, then for real.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

type Args = {
  dry: boolean;
  min: number;
  kind: "sequel" | "variant" | "remake" | null;
  reset: boolean;
};
function parseArgs(): Args {
  const a: Args = { dry: false, min: 2, kind: null, reset: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--reset") a.reset = true;
    else if (arg.startsWith("--min=")) a.min = Number(arg.slice(6));
    else if (arg.startsWith("--kind=")) {
      const k = arg.slice(7);
      if (k === "sequel" || k === "variant" || k === "remake") a.kind = k;
    }
  }
  return a;
}

type Map = { id: number; name: string; series_id: number | null };

type Cluster = {
  stem: string;
  kind: "sequel" | "variant" | "remake";
  members: { id: number; name: string; position: number | null }[];
};

// --- Normalization helpers ---------------------------------------------------

const ROMAN = /\s+(?:[IVX]+)$/;
const TRAILING_DIGITS = /\s+(\d+)$/;
const VARIANT_PAREN = /\s*\(([eEnNhHiI])\)$/; // (E) (N) (H) (I)
const VERSION_SUFFIX = /\s+v?\d+(?:\.\d+)+$/i; // " 2.0", " v3.1"
const ERA_EDITION = /\s*[\-–—]?\s*(?:\(|\b)?era\s+edition\)?$/i;
const HOTA_EDITION = /\s*\(hota\)$/i;
const TRAILING_PUNCT = /[\s\-–—_:.]+$/;

const ROMAN_VALUES: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

/** Returns the sequel position embedded in the name, if any. Rejects
 *  4-digit numbers (likely years, e.g. "Epic map 2015") and zero. */
function extractPosition(name: string): number | null {
  const arabic = name.match(TRAILING_DIGITS);
  if (arabic) {
    const n = Number(arabic[1]);
    if (n > 0 && n < 100) return n;
    return null;
  }
  const roman = name.match(ROMAN);
  if (roman) {
    const r = roman[0].trim().toUpperCase();
    if (r in ROMAN_VALUES) return ROMAN_VALUES[r];
  }
  return null;
}

/** True if the name has an explicit "this is a re-edit" marker. */
function hasRemakeMarker(name: string): boolean {
  return VERSION_SUFFIX.test(name) || ERA_EDITION.test(name);
}

/**
 * Strip the things that distinguish *members* of a series so the rest
 * acts as a cluster key. Returns the stem in lowercase + collapsed
 * whitespace.
 */
function stem(name: string): string {
  let s = name;
  s = s.replace(VARIANT_PAREN, "");
  s = s.replace(HOTA_EDITION, "");
  s = s.replace(ERA_EDITION, "");
  s = s.replace(VERSION_SUFFIX, "");
  // Strip trailing roman/arabic AFTER the above so "Era Edition III" still works.
  s = s.replace(ROMAN, "");
  s = s.replace(TRAILING_DIGITS, "");
  s = s.replace(TRAILING_PUNCT, "");
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Identify what kind of relationship the cluster represents.
 *  Returns null if the cluster doesn't look like a real series at all
 *  (e.g. just two unrelated maps that happen to share a name). */
function inferKind(
  names: string[]
): "sequel" | "variant" | "remake" | null {
  const allVariant = names.every((n) => VARIANT_PAREN.test(n));
  if (allVariant) return "variant";

  const anySequel = names.some(
    (n) => extractPosition(n) !== null && (ROMAN.test(n) || TRAILING_DIGITS.test(n))
  );
  if (anySequel) return "sequel";

  // For "remake" we require at least one explicit version marker — a
  // bare "Game of Thrones" × 4 cluster is just same-named maps by
  // different authors, not a series.
  if (names.some(hasRemakeMarker)) return "remake";

  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

// --- Main --------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  if (args.reset && !args.dry) {
    await sql`UPDATE maps SET series_id = NULL, series_position = NULL`;
    await sql`DELETE FROM map_series`;
    console.log("Reset existing series assignments.");
  }

  const maps = (await sql<
    { id: number; name: string; series_id: number | null }[]
  >`SELECT id, name, series_id FROM maps`) as Map[];

  // Group by stem.
  const groups = new Map<string, Map[]>();
  for (const m of maps) {
    const s = stem(m.name);
    // Reject stems too short to be meaningful — single words like
    // "Battle" produce huge false-positive clusters.
    if (s.length < 5) continue;
    const arr = groups.get(s) ?? [];
    arr.push(m);
    groups.set(s, arr);
  }

  // Build clusters that survive the threshold.
  const clusters: Cluster[] = [];
  for (const [s, members] of groups) {
    if (members.length < args.min) continue;
    const kind = inferKind(members.map((m) => m.name));
    if (kind === null) continue;
    if (args.kind && kind !== args.kind) continue;
    // Require positions to be non-null for sequels — a "sequel"
    // cluster of 5 maps where none has a number is suspect.
    if (kind === "sequel") {
      const withPos = members.filter((m) => extractPosition(m.name) !== null);
      if (withPos.length < members.length / 2) continue;
    }
    clusters.push({
      stem: s,
      kind,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        position: kind === "sequel" ? extractPosition(m.name) : null,
      })),
    });
  }

  clusters.sort((a, b) => b.members.length - a.members.length);

  console.log(
    `\nFound ${clusters.length} candidate series (min size ${args.min}).\n`
  );

  let written = 0;
  for (const c of clusters) {
    console.log(
      `  [${c.kind.padEnd(7)}] ${c.stem}  (${c.members.length} maps)`
    );
    const sorted = [...c.members].sort((a, b) => {
      if (a.position != null && b.position != null) return a.position - b.position;
      if (a.position != null) return -1;
      if (b.position != null) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const m of sorted) {
      const pos = m.position != null ? ` #${m.position}` : "";
      console.log(`        - [${m.id}]${pos} ${m.name}`);
    }

    if (args.dry) continue;

    // Use the longest member name (minus suffix) as a friendlier
    // canonical name than the lowercased stem.
    const canonicalName = c.members
      .map((m) => stem(m.name))
      .reduce((a, b) => (a.length >= b.length ? a : b));
    const titleCased = titleCase(canonicalName);
    const slug = slugify(titleCased) || `series-${Date.now()}`;

    const [series] = await sql<{ id: number }[]>`
      INSERT INTO map_series (slug, name, kind)
      VALUES (${slug}, ${titleCased}, ${c.kind})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind
      RETURNING id
    `;
    for (const m of sorted) {
      await sql`
        UPDATE maps SET series_id = ${series.id}, series_position = ${m.position}
        WHERE id = ${m.id}
      `;
    }
    written++;
  }

  console.log(
    args.dry
      ? `\n(dry run) would create ${clusters.length} series.`
      : `\nWrote ${written} series.`
  );

  await sql.end();
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
