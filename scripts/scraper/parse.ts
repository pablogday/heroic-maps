import * as cheerio from "cheerio";

export type ScrapedMap = {
  sourceId: number;
  name: string;
  author: string | null;
  versionRaw: string | null;
  addedRaw: string | null;
  ratingScore: number | null;
  downloadCount: number | null;
  sizeRaw: string | null;
  difficultyRaw: string | null;
  humanPlayers: number | null;
  totalPlayers: number | null;
  teamCount: number | null;
  hasUnderground: boolean;
  previewUrl: string | null;
  undergroundUrl: string | null;
  description: string | null;
  sourceUrl: string;
};

const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
};

const txt = (s: string) => s.replace(/\s+/g, " ").trim();

const ABS = (rel: string) =>
  rel.startsWith("http")
    ? rel
    : "https://www.maps4heroes.com" +
      (rel.startsWith("/") ? rel : "/heroes3/" + rel.replace(/^\.\.\//, ""));

export function parseListingPage(html: string): ScrapedMap[] {
  const $ = cheerio.load(html);
  const results: ScrapedMap[] = [];

  // Each map is in an outer <table border=1> with two inner tables of class
  // maps_table followed by a <tr><td>description</td></tr> row.
  $("table[border='1']").each((_, outer) => {
    const $outer = $(outer);
    const tables = $outer.find("table.maps_table");
    if (tables.length < 1) return;

    const $main = tables.eq(0);
    const link = $main.find("a[href*='opinions.php?map_id=']").first();
    const href = link.attr("href") ?? "";
    const idMatch = href.match(/map_id=(\d+)/);
    if (!idMatch) return;
    const sourceId = parseInt(idMatch[1], 10);

    const previewImg = $main.find("img").first().attr("src");
    const previewUrl = previewImg ? ABS(previewImg) : null;

    const name = txt($main.find("a > b").first().text());
    if (!name) return;

    // Right cell of first table — replace <br> with newlines so labels split cleanly.
    const rightCell = $main.find("td[align=center][valign=top]").first();
    rightCell.find("br, BR, hr, HR").replaceWith("\n");
    const rightText = rightCell.text();

    const line = (label: RegExp): string | null => {
      for (const raw of rightText.split(/\n+/)) {
        const l = txt(raw);
        const m = l.match(label);
        if (m) return txt(m[1]);
      }
      return null;
    };

    const author = line(/^by\s+(.+)$/i);
    const versionRaw = line(/^Type\s+(.+)$/i);
    const addedRaw = line(/^Added\s+(\d{2}-\d{2}-\d{4})/);
    const ratingScore = num(line(/^Rating\s*:?\s*(.+)$/i));
    const downloadCount = num(line(/^Download\s*:?\s*(.+)$/i));

    // Second table holds size/diff/players + maybe underground image
    const $meta = tables.eq(1);
    $meta.find("br, BR").replaceWith("\n");
    const metaText = $meta.text();
    const undergroundImg = $meta.find("img").attr("src");
    const undergroundUrl = undergroundImg ? ABS(undergroundImg) : null;

    const metaLine = (label: RegExp): string | null => {
      for (const raw of metaText.split(/\n+/)) {
        const l = txt(raw);
        const m = l.match(label);
        if (m) return txt(m[1]);
      }
      return null;
    };

    const sizeRaw = metaLine(/^Size\s*:\s*(.+)$/i);
    const difficultyRaw = metaLine(/^Difficulty\s*:\s*(.+)$/i);
    const humanPlayers = num(metaLine(/^Can be Human\s*:\s*(.+)$/i));
    const totalPlayers = num(metaLine(/^Players\s*:\s*(.+)$/i));
    const teamCount = num(metaLine(/^Teams\s*:\s*(.+)$/i));

    // Description is in the next <tr><td> after the inner tables — the last
    // top-level td of the outer table.
    const descCell = $outer.find("> tbody > tr").last().find("> td").last();
    const description = descCell.length
      ? txt(descCell.text()).slice(0, 4000)
      : null;

    results.push({
      sourceId,
      name,
      author,
      versionRaw,
      addedRaw,
      ratingScore,
      downloadCount,
      sizeRaw,
      difficultyRaw,
      humanPlayers,
      totalPlayers,
      teamCount,
      hasUnderground: !!undergroundUrl,
      previewUrl,
      undergroundUrl,
      description,
      sourceUrl: `https://www.maps4heroes.com/forum/opinions.php?map_id=${sourceId}&game=3`,
    });
  });

  // Dedupe — outer table selector can match nested tables in some pages
  const seen = new Set<number>();
  return results.filter((r) => {
    if (seen.has(r.sourceId)) return false;
    seen.add(r.sourceId);
    return true;
  });
}

export function parsePageCount(html: string): number {
  // Look for the highest ?limit=N in pagination
  const $ = cheerio.load(html);
  let max = 0;
  $("a[href*='limit=']").each((_, el) => {
    const m = ($(el).attr("href") || "").match(/limit=(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return max + 1; // limit=N is 0-indexed page number
}

// Mapping helpers

const SIZE_MAP: Record<string, "S" | "M" | "L" | "XL" | "H" | "XH" | "G"> = {
  small: "S",
  medium: "M",
  large: "L",
  "extra large": "XL",
  huge: "H",
  "extra huge": "XH",
  giant: "G",
};
export const mapSize = (raw: string | null) =>
  raw ? SIZE_MAP[raw.trim().toLowerCase()] ?? null : null;

const DIFF_MAP: Record<
  string,
  "easy" | "normal" | "hard" | "expert" | "impossible"
> = {
  easy: "easy",
  normal: "normal",
  hard: "hard",
  expert: "expert",
  impossible: "impossible",
};
export const mapDifficulty = (raw: string | null) =>
  raw ? DIFF_MAP[raw.trim().toLowerCase()] ?? null : null;

export const mapVersion = (
  raw: string | null
):
  | "RoE"
  | "AB"
  | "SoD"
  | "HotA"
  | "WoG"
  | "Chronicles"
  | "HD"
  | "Other"
  | null => {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes("horn of the abyss")) return "HotA";
  if (r.includes("wake of gods")) return "WoG";
  if (r.includes("shadow of death")) return "SoD";
  if (r.includes("armageddon")) return "AB";
  if (r.includes("chronicles")) return "Chronicles";
  if (r.includes("hd")) return "HD";
  if (r.includes("restoration of erathia") || r === "heroes 3") return "RoE";
  if (r.includes("heroes 3")) return "Other";
  return "Other";
};

export const slugify = (name: string, id: number) =>
  (name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "map") +
  "-" +
  id;

export const parseAddedDate = (raw: string | null): Date | null => {
  if (!raw) return null;
  const m = raw.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
};
