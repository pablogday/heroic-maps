import { BinaryReader } from "./reader";
import type { FormatId } from "./versions";

/**
 * Special victory and loss conditions follow the 8 player blocks.
 *
 * The format is:
 *   victory:
 *     u8 type (0xff = standard "defeat all enemies", no extra bytes)
 *     if type != 0xff:
 *       u8 allowNormalWin
 *       u8 appliesToAI
 *       <type-specific params>
 *
 *   loss:
 *     u8 type (0xff = standard "lose all towns and heroes")
 *     if type != 0xff:
 *       <type-specific params>
 *
 * Cross-checked against VCMI's MapFormatH3M.cpp.
 */

export type VictoryType =
  | "standard"
  | "acquire-artifact"
  | "accumulate-creatures"
  | "accumulate-resources"
  | "upgrade-town"
  | "build-grail"
  | "defeat-hero"
  | "capture-town"
  | "defeat-monster"
  | "flag-dwellings"
  | "flag-mines"
  | "transport-artifact"
  | "unknown";

export type LossType =
  | "standard"
  | "lose-town"
  | "lose-hero"
  | "time-expires"
  | "unknown";

export interface VictoryCondition {
  type: VictoryType;
  allowNormalWin: boolean;
  appliesToAI: boolean;
  /** Human-readable summary, suitable for the DB column. */
  description: string;
}

export interface LossCondition {
  type: LossType;
  description: string;
}

const VICTORY_TYPES: VictoryType[] = [
  "acquire-artifact",
  "accumulate-creatures",
  "accumulate-resources",
  "upgrade-town",
  "build-grail",
  "defeat-hero",
  "capture-town",
  "defeat-monster",
  "flag-dwellings",
  "flag-mines",
  "transport-artifact",
];

const LOSS_TYPES: LossType[] = ["lose-town", "lose-hero", "time-expires"];

const RESOURCE_NAMES = [
  "wood",
  "mercury",
  "ore",
  "sulfur",
  "crystal",
  "gems",
  "gold",
];

export function parseVictory(
  reader: BinaryReader,
  format: FormatId
): VictoryCondition {
  const code = reader.u8();
  if (code === 0xff) {
    return {
      type: "standard",
      allowNormalWin: true,
      appliesToAI: false,
      description: "Defeat all enemies",
    };
  }
  const allowNormalWin = reader.bool();
  const appliesToAI = reader.bool();
  const type = VICTORY_TYPES[code] ?? "unknown";
  const description = readVictoryParams(reader, type, format);
  return { type, allowNormalWin, appliesToAI, description };
}

function readVictoryParams(
  reader: BinaryReader,
  type: VictoryType,
  format: FormatId
): string {
  switch (type) {
    case "acquire-artifact": {
      const artId = format === "RoE" ? reader.u8() : reader.u16le();
      return `Acquire artifact #${artId}`;
    }
    case "accumulate-creatures": {
      const creatureId = format === "RoE" ? reader.u8() : reader.u16le();
      const count = reader.u32le();
      return `Accumulate ${count} of creature #${creatureId}`;
    }
    case "accumulate-resources": {
      const resourceId = reader.u8();
      const amount = reader.u32le();
      const name = RESOURCE_NAMES[resourceId] ?? `resource#${resourceId}`;
      return `Accumulate ${amount} ${name}`;
    }
    case "upgrade-town": {
      reader.skip(3); // position
      const hallLevel = reader.u8();
      const castleLevel = reader.u8();
      return `Upgrade specific town (hall ${hallLevel}, castle ${castleLevel})`;
    }
    case "build-grail": {
      reader.skip(3); // position (0xffffff = anywhere)
      return "Build Grail structure";
    }
    case "defeat-hero": {
      reader.skip(3);
      return "Defeat a specific hero";
    }
    case "capture-town": {
      reader.skip(3);
      return "Capture a specific town";
    }
    case "defeat-monster": {
      reader.skip(3);
      return "Defeat a specific monster";
    }
    case "flag-dwellings":
      return "Flag all creature dwellings";
    case "flag-mines":
      return "Flag all mines";
    case "transport-artifact": {
      const artId = reader.u8();
      reader.skip(3); // destination position
      return `Transport artifact #${artId} to a specific location`;
    }
    default:
      return "Unknown victory condition";
  }
}

export function parseLoss(reader: BinaryReader): LossCondition {
  const code = reader.u8();
  if (code === 0xff) {
    return {
      type: "standard",
      description: "Lose all towns and heroes",
    };
  }
  const type = LOSS_TYPES[code] ?? "unknown";
  switch (type) {
    case "lose-town":
      reader.skip(3);
      return { type, description: "Lose a specific town" };
    case "lose-hero":
      reader.skip(3);
      return { type, description: "Lose a specific hero" };
    case "time-expires": {
      const days = reader.u16le();
      return { type, description: `Time expires (${days} days)` };
    }
    default:
      return { type: "unknown", description: "Unknown loss condition" };
  }
}
