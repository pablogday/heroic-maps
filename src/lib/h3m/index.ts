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
  type PlayerSlot,
} from "./playerInfo";
import {
  parseVictory,
  parseLoss,
  type VictoryCondition,
  type LossCondition,
} from "./conditions";

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
  warnings: string[];
  /** Filled if confidence=failed. */
  error: string | null;
}

const SUPPORTED_V0_1: ReadonlySet<FormatId> = new Set<FormatId>([
  "RoE",
  "AB",
  "SoD",
]);

export function parseH3m(input: Buffer): ParseResult {
  const warnings: string[] = [];

  let raw: Buffer;
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

  if (!SUPPORTED_V0_1.has(format)) {
    return {
      ...emptyResult(format, versionMagic),
      error:
        format === "Unknown"
          ? `unrecognized version magic 0x${versionMagic
              .toString(16)
              .padStart(8, "0")}`
          : `format ${format} not supported by parser v0.2`,
    };
  }

  let header: BasicHeader;
  try {
    header = parseBasicHeader(reader, format);
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
  // "partial" — we still keep the basic header.
  let players: PlayerSlot[] | null = null;
  let victory: VictoryCondition | null = null;
  let loss: LossCondition | null = null;
  try {
    players = parsePlayers(reader, format);
    victory = parseVictory(reader, format);
    loss = parseLoss(reader);
  } catch (e) {
    warnings.push(`players/conditions: ${errMsg(e)}`);
  }

  const counts = players
    ? summarizePlayers(players)
    : { totalPlayers: null, humanPlayers: null, aiPlayers: null };

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
export { unwrapMapFile } from "./unwrap";
export type { Unwrapped } from "./unwrap";
