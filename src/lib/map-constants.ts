export const VERSIONS = [
  "RoE",
  "AB",
  "SoD",
  "HotA",
  "WoG",
  "Chronicles",
  "HD",
  "Other",
] as const;
export type Version = (typeof VERSIONS)[number];

/**
 * Full names for each version. Mirror of the `map_versions` lookup
 * table seeded in `drizzle/0001_add_meta_lookup_tables.sql`. Change one,
 * change both. The DB is canonical for server-side display; this mirror
 * exists for client components that can't await an async DB call.
 */
export const VERSION_LABEL: Record<Version, string> = {
  RoE: "Restoration of Erathia",
  AB: "Armageddon's Blade",
  SoD: "The Shadow of Death",
  HotA: "Horn of the Abyss",
  WoG: "In the Wake of Gods",
  Chronicles: "Chronicles",
  HD: "HD Edition",
  Other: "Other",
};

/** Sync, isomorphic label lookup. Falls back to the code if unknown. */
export function versionLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return VERSION_LABEL[code as Version] ?? code;
}
export function sizeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return SIZE_LABEL[code as Size] ?? code;
}
export function difficultyLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return DIFFICULTY_LABEL[code as Difficulty] ?? code;
}

export const SIZES = ["S", "M", "L", "XL", "H", "XH", "G"] as const;
export type Size = (typeof SIZES)[number];

export const SIZE_LABEL: Record<Size, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Extra Large",
  H: "Huge",
  XH: "Extra Huge",
  G: "Giant",
};

export const DIFFICULTIES = [
  "easy",
  "normal",
  "hard",
  "expert",
  "impossible",
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  expert: "Expert",
  impossible: "Impossible",
};

export const SORT_OPTIONS = [
  { value: "downloads", label: "Most downloaded" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A–Z)" },
] as const;
export type Sort = (typeof SORT_OPTIONS)[number]["value"];
