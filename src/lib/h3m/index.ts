/**
 * Public API for the .h3m parser.
 *
 * Goal: extract enough metadata from a Heroes 3 map file to power the
 * upload form's auto-fill UX and backfill the scraped corpus's empty
 * win/loss conditions. Built header-first, version-by-version, with
 * a confidence flag so callers can decide how much to trust.
 *
 * Versions supported:
 *   v0.1 — SoD, AB, RoE: basic header (size, name, difficulty, …)
 *
 * Roadmap (see web/ROADMAP.md):
 *   v0.2 — player blocks, win/loss conditions
 *   v0.3 — HotA family
 *   v0.4 — WoG, Chronicles
 *   v1.0 — minimap rendering from terrain
 */
import { decompress, isGzip } from "./decompress";
import { BinaryReader, EofError } from "./reader";
import {
  VERSION_MAGIC,
  toMapVersion,
  type FormatId,
} from "./versions";
import { parseBasicHeader, type BasicHeader } from "./header";
import {
  parsePlayers,
  summarizePlayers,
  summarizeFactions,
  type PlayerSlot,
} from "./playerInfo";
import {
  parseVictory,
  parseLoss,
  type VictoryCondition,
  type LossCondition,
} from "./conditions";
import { parseHotaPrefix } from "./hota";
import { walkToTerrain } from "./worldData";
import { parseTerrain, type Terrain } from "./terrain";

export type Confidence = "high" | "partial" | "failed";

export interface ParseResult {
  confidence: Confidence;
  format: FormatId;
  /** Raw u32 magic that started the file. Useful when format=Unknown. */
  versionMagic: number;
  /** Mapped to the project's `mapVersionEnum`. */
  mapVersion: ReturnType<typeof toMapVersion>;
  header: BasicHeader | null;
  players: PlayerSlot[] | null;
  totalPlayers: number | null;
  humanPlayers: number | null;
  aiPlayers: number | null;
  victory: VictoryCondition | null;
  loss: LossCondition | null;
  /** Faction codes (our project's enum) playable across all enabled
   * slots; union of each slot's allowedFactions bitmask. */
  factions: string[] | null;
  /** Byte offset of the terrain layer in the decompressed stream,
   * if the parser walked there successfully. Null when we didn't
   * try (HotA/WoG path) or the walk failed. */
  terrainOffset: number | null;
  /** Parsed terrain grid (surface + optional underground). Null when
   * `terrainOffset` is null. */
  terrain: Terrain | null;
  warnings: string[];
  /** Filled if confidence=failed. */
  error: string | null;
}

const SUPPORTED_FORMATS: ReadonlySet<FormatId> = new Set<FormatId>([
  "RoE",
  "AB",
  "SoD",
  "HotA1",
  "HotA2",
  "HotA3",
  "WoG",
]);

const HOTA_FORMATS: ReadonlySet<FormatId> = new Set<FormatId>([
  "HotA1",
  "HotA2",
  "HotA3",
]);

export function parseH3m(input: Uint8Array): ParseResult {
  const warnings: string[] = [];

  let raw: Uint8Array;
  try {
    raw = isGzip(input) ? decompress(input) : input;
  } catch (e) {
    return failed(`gunzip failed: ${errMsg(e)}`);
  }
  if (raw.length < 8) {
    return failed(`file too small (${raw.length} bytes)`);
  }

  const reader = new BinaryReader(raw);
  const versionMagic = reader.u32le();
  const format = VERSION_MAGIC[versionMagic] ?? "Unknown";

  if (!SUPPORTED_FORMATS.has(format)) {
    return {
      ...emptyResult(format, versionMagic),
      error:
        format === "Unknown"
          ? `unrecognized version magic 0x${versionMagic
              .toString(16)
              .padStart(8, "0")}`
          : format === "Campaign06" || format === "Campaign0A"
            ? "campaign archive (.h3c) — not a single-map file"
            : `format ${format} not yet supported by parser`,
    };
  }

  // HotA inserts a variable-length prefix between the version magic
  // and the SoD-compatible basic header. Skip past it before reading
  // the header normally.
  if (HOTA_FORMATS.has(format)) {
    try {
      parseHotaPrefix(reader);
    } catch (e) {
      return {
        ...emptyResult(format, versionMagic),
        error: `HotA prefix: ${errMsg(e)}`,
      };
    }
  }

  let header: BasicHeader;
  // HotA's basic header layout matches SoD; WoG is also a SoD
  // descendant. Treat both as SoD for header + player-block widths.
  const headerFormat = HOTA_FORMATS.has(format) || format === "WoG"
    ? "SoD"
    : format;
  try {
    header = parseBasicHeader(reader, headerFormat);
  } catch (e) {
    if (e instanceof EofError) {
      return {
        ...emptyResult(format, versionMagic),
        error: e.message,
      };
    }
    return failed(`header parse failed: ${errMsg(e)}`, format, versionMagic);
  }

  if (header.size === null) {
    warnings.push(`unknown map width ${header.width}`);
  }
  if (header.difficulty === null) {
    warnings.push(`unknown difficulty byte`);
  }

  // From here on, anything that fails downgrades the result to
  // "partial" — we still keep the basic header. For HotA we attempt
  // SoD-shape player blocks (best guess; faction bitmask width is
  // the same and most fields appear identical).
  let players: PlayerSlot[] | null = null;
  let victory: VictoryCondition | null = null;
  let loss: LossCondition | null = null;
  const playerFormat =
    HOTA_FORMATS.has(format) || format === "WoG" ? "SoD" : format;
  try {
    players = parsePlayers(reader, playerFormat);
    victory = parseVictory(reader, playerFormat);
    loss = parseLoss(reader);
  } catch (e) {
    warnings.push(`players/conditions: ${errMsg(e)}`);
  }

  const counts = players
    ? summarizePlayers(players)
    : { totalPlayers: null, humanPlayers: null, aiPlayers: null };
  const factions = players ? summarizeFactions(players) : null;

  // Walk past everything between conditions and terrain so we know
  // where the terrain layer starts. HotA/WoG use the same layout as
  // SoD here (player blocks were the same too, empirically).
  let terrainOffset: number | null = null;
  let terrain: Terrain | null = null;
  if (players && victory && loss) {
    const walkFormat: "RoE" | "AB" | "SoD" =
      HOTA_FORMATS.has(format) || format === "WoG"
        ? "SoD"
        : format === "RoE" || format === "AB"
          ? format
          : "SoD";
    try {
      walkToTerrain(reader, walkFormat);
      terrainOffset = reader.offset;
      terrain = parseTerrain(
        reader,
        header.width,
        header.width,
        header.hasUnderground
      );
    } catch {
      // Diagnostic only — surfaces via terrain === null.
    }
  }

  return {
    confidence: confidenceFor(warnings, players, victory, loss),
    format,
    versionMagic,
    mapVersion: toMapVersion(format),
    header,
    players,
    totalPlayers: counts.totalPlayers,
    humanPlayers: counts.humanPlayers,
    aiPlayers: counts.aiPlayers,
    victory,
    loss,
    factions,
    terrainOffset,
    terrain,
    warnings,
    error: null,
  };
}

function confidenceFor(
  warnings: string[],
  players: PlayerSlot[] | null,
  victory: VictoryCondition | null,
  loss: LossCondition | null
): Confidence {
  if (!players || !victory || !loss) return "partial";
  return warnings.length === 0 ? "high" : "partial";
}

function emptyResult(format: FormatId, versionMagic: number): ParseResult {
  return {
    confidence: "failed",
    format,
    versionMagic,
    mapVersion: toMapVersion(format),
    header: null,
    players: null,
    totalPlayers: null,
    humanPlayers: null,
    aiPlayers: null,
    victory: null,
    loss: null,
    factions: null,
    terrainOffset: null,
    terrain: null,
    warnings: [],
    error: null,
  };
}

function failed(
  error: string,
  format: FormatId = "Unknown",
  versionMagic = 0
): ParseResult {
  return { ...emptyResult(format, versionMagic), error };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type { BasicHeader } from "./header";
export type { FormatId } from "./versions";
export type { PlayerSlot } from "./playerInfo";
export type { VictoryCondition, LossCondition } from "./conditions";
export type { Terrain, Tile } from "./terrain";
export { TERRAIN_NAMES, terrainPlausibility } from "./terrain";
export { renderMinimap, TERRAIN_COLOR } from "./render";
export type { MinimapImage, RenderOptions } from "./render";
export { unwrapMapFile } from "./unwrap";
export type { Unwrapped } from "./unwrap";
