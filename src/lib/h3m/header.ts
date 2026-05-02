import { BinaryReader } from "./reader";
import type { FormatId } from "./versions";
import { isSoDFamily } from "./versions";

/** Standard HoMM3 widths in ascending order, paired with our enum. */
const STANDARD_SIZES: Array<[number, SizeCode]> = [
  [36, "S"],
  [72, "M"],
  [108, "L"],
  [144, "XL"],
  [180, "H"], // HotA "Huge"
  [216, "XH"], // HotA "Extra Huge"
  [252, "G"], // HotA "Giant"
];

/**
 * Map width → size code. Exact matches first; otherwise rounds to the
 * nearest standard size (some community / random-generator maps use
 * non-standard widths like 18, 90, 256).
 */
function sizeFromWidth(width: number): SizeCode | null {
  if (width <= 0) return null;
  for (const [w, code] of STANDARD_SIZES) {
    if (w === width) return code;
  }
  // Round to nearest standard size.
  let best = STANDARD_SIZES[0];
  let bestDiff = Math.abs(width - best[0]);
  for (const candidate of STANDARD_SIZES) {
    const diff = Math.abs(width - candidate[0]);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best[1];
}

export type SizeCode = "S" | "M" | "L" | "XL" | "H" | "XH" | "G";
export type DifficultyCode =
  | "easy"
  | "normal"
  | "hard"
  | "expert"
  | "impossible";

const DIFFICULTIES: readonly DifficultyCode[] = [
  "easy",
  "normal",
  "hard",
  "expert",
  "impossible",
] as const;

export interface BasicHeader {
  /** Tile width = height (square maps). */
  width: number;
  /** Mapped size code; null if width is unrecognized. */
  size: SizeCode | null;
  hasUnderground: boolean;
  name: string;
  description: string;
  difficulty: DifficultyCode | null;
  /** AB+ only. 0 = no cap. Null on RoE. */
  heroLevelLimit: number | null;
  /** Whether the map allows player slots — diagnostic only. */
  areAnyPlayers: boolean;
}

/**
 * Parse the leading "basic header" of an .h3m, *after* the 4-byte
 * version magic has already been consumed by the caller.
 *
 * Confirmed against the VCMI implementation (mapping/MapFormatH3M.cpp,
 * `readHeader`) for the SoD/AB/RoE branches. HotA-specific extensions
 * after the standard fields are not consumed here — we stop at the
 * level-limit byte (or end of basics for RoE).
 */
export function parseBasicHeader(
  reader: BinaryReader,
  format: FormatId
): BasicHeader {
  const areAnyPlayers = reader.bool();
  const width = reader.u32le();
  const hasUnderground = reader.bool();
  const name = reader.string();
  const description = reader.string();
  const difficultyByte = reader.u8();
  const difficulty = DIFFICULTIES[difficultyByte] ?? null;

  // RoE has no level limit; SoD/AB/HotA/WoG do. Treat all non-RoE as
  // having it — this matches the VCMI branch.
  let heroLevelLimit: number | null = null;
  if (format !== "RoE") {
    heroLevelLimit = reader.u8();
  }
  // Note: for RoE we deliberately don't read the byte; downstream
  // parsers (player blocks) must continue from here.
  // SoD-family check is informational right now; if we extend to read
  // player blocks we'll dispatch on `format`.
  void isSoDFamily;

  return {
    width,
    size: sizeFromWidth(width),
    hasUnderground,
    name,
    description,
    difficulty,
    heroLevelLimit,
    areAnyPlayers,
  };
}
