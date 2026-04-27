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
