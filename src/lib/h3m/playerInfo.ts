import { BinaryReader } from "./reader";
import type { FormatId } from "./versions";

/**
 * Player slot info. There are always exactly 8 slots in a .h3m,
 * one per color (Red, Blue, Tan, Green, Orange, Purple, Teal, Pink).
 *
 * Disabled slots (neither human nor AI may play) still occupy a fixed
 * number of bytes that we have to skip — see DISABLED_SKIP per format.
 *
 * Enabled slots have a variable-length structure that we parse fully
 * so the cursor lands exactly at the start of the victory-condition
 * byte after all 8 slots.
 *
 * Cross-checked against VCMI's MapFormatH3M.cpp::readPlayerInfo.
 */
export interface PlayerSlot {
  canHumanPlay: boolean;
  canComputerPlay: boolean;
  enabled: boolean;
  /** Bitmask of factions this player may pick. Bit positions match
   * the FACTIONS array order: 0=castle … 8=conflux. */
  allowedFactions: number;
}

/** Bytes to skip after the two play-flags when neither flag is set. */
const DISABLED_SKIP: Partial<Record<FormatId, number>> = {
  RoE: 6,
  AB: 12,
  SoD: 13,
};

export function parsePlayers(
  reader: BinaryReader,
  format: FormatId
): PlayerSlot[] {
  const slots: PlayerSlot[] = [];
  for (let i = 0; i < 8; i++) {
    slots.push(parseOneSlot(reader, format));
  }
  return slots;
}

function parseOneSlot(reader: BinaryReader, format: FormatId): PlayerSlot {
  const canHumanPlay = reader.bool();
  const canComputerPlay = reader.bool();
  const enabled = canHumanPlay || canComputerPlay;

  if (!enabled) {
    const skip = DISABLED_SKIP[format];
    if (skip === undefined) {
      throw new Error(`disabled-slot skip not known for format ${format}`);
    }
    reader.skip(skip);
    return { canHumanPlay, canComputerPlay, enabled, allowedFactions: 0 };
  }

  // aiTactic
  reader.u8();
  // SoD/WoG: extra "p7" byte (placeholder-related flag)
  if (format === "SoD") {
    reader.u8();
  }
  // allowedFactions bitmask: 1 byte for RoE, 2 bytes for AB/SoD
  const allowedFactions =
    format === "RoE" ? reader.u8() : reader.u16le();
  // isFactionRandom
  reader.u8();

  const hasMainTown = reader.bool();
  if (hasMainTown) {
    if (format !== "RoE") {
      // generateHeroAtMainTown + generateHero
      reader.skip(2);
    }
    // position (x, y, z)
    reader.skip(3);
  }

  // hasRandomHero
  reader.u8();
  // mainCustomHeroId
  const mainHeroId = reader.u8();
  if (mainHeroId !== 0xff) {
    // portrait + name
    reader.u8();
    reader.string();
  }

  if (format !== "RoE") {
    // powerPlaceholders
    reader.u8();
    // heroCount (u8) + 3 bytes padding
    const heroCount = reader.u8();
    reader.skip(3);
    for (let h = 0; h < heroCount; h++) {
      reader.u8(); // heroId
      reader.string(); // heroName
    }
  }

  return { canHumanPlay, canComputerPlay, enabled, allowedFactions };
}

/**
 * Bit position → our `Faction` codes. Matches in-game town order.
 */
const FACTION_BIT_NAMES = [
  "castle",
  "rampart",
  "tower",
  "inferno",
  "necropolis",
  "dungeon",
  "stronghold",
  "fortress",
  "conflux",
] as const;

/**
 * Union of allowed factions across enabled players, as our project's
 * faction codes. Conservative: skips disabled slots and the "random"
 * bit (no fixed bit position — that's a separate flag).
 */
export function summarizeFactions(slots: PlayerSlot[]): string[] {
  let mask = 0;
  for (const s of slots) {
    if (s.enabled) mask |= s.allowedFactions;
  }
  const out: string[] = [];
  for (let i = 0; i < FACTION_BIT_NAMES.length; i++) {
    if (mask & (1 << i)) out.push(FACTION_BIT_NAMES[i]);
  }
  return out;
}

export function summarizePlayers(slots: PlayerSlot[]): {
  totalPlayers: number;
  humanPlayers: number;
  aiPlayers: number;
} {
  let total = 0;
  let human = 0;
  let ai = 0;
  for (const s of slots) {
    if (!s.enabled) continue;
    total++;
    if (s.canHumanPlay) human++;
    else if (s.canComputerPlay) ai++;
  }
  return { totalPlayers: total, humanPlayers: human, aiPlayers: ai };
}
