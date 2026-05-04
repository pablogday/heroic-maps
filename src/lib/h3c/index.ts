/**
 * Parser for HoMM3 .h3c (campaign) files.
 *
 * Format: a multi-member gzip stream where the FIRST member is the
 * campaign descriptor (header + all scenario metadata) and each
 * subsequent member is an embedded .h3m for one scenario. We only
 * decode the descriptor — the embedded maps can be re-parsed with the
 * regular .h3m parser later if we want to render minimaps per
 * scenario.
 *
 * Cross-checked against VCMI's `lib/campaign/CampaignHandler.cpp`.
 *
 *   import { parseH3c, isCampaignMagic } from "@/lib/h3c";
 *   const result = parseH3c(rawBytes);  // bytes already gunzipped
 */

import { BinaryReader } from "../h3m/reader";

// Campaign version magic (u32le at offset 0 of the decompressed stream).
// Values from VCMI's CampaignVersion enum (CampaignConstants.h):
export const CAMPAIGN_VERSION = {
  RoE: 4,
  AB: 5,
  SoD: 6,
  Chr: 7, // Chronicles
  HotA: 10,
} as const;

export type CampaignVersionId = "RoE" | "AB" | "SoD" | "Chr" | "HotA";

export function campaignVersionLabel(magic: number): CampaignVersionId | null {
  switch (magic) {
    case 4:
      return "RoE";
    case 5:
      return "AB";
    case 6:
      return "SoD";
    case 7:
      return "Chr";
    case 10:
      return "HotA";
    default:
      return null;
  }
}

/** Cheap pre-check for the version magic on already-decompressed bytes. */
export function isCampaignMagic(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  if (buf[1] !== 0 || buf[2] !== 0 || buf[3] !== 0) return false;
  return [4, 5, 6, 7, 10].includes(buf[0]);
}

export interface CampaignScenario {
  /** The scenario's filename (e.g. "Mission1.h3m") — also used as a key. */
  mapName: string;
  /** Bytes of the embedded .h3m (after gunzip), declared in the campaign
   * descriptor. We don't read the bytes themselves yet — kept as a hint
   * for future scenario-detail rendering. */
  packedMapSize: number;
  /** Color index (0..7) used to tint the region on the campaign map. */
  regionColor: number;
  /** Game difficulty 0..4 (easy → impossible). */
  difficulty: number;
  /** Localized story shown when hovering the region on the campaign map. */
  regionText: string;
  /** Cinematic/prologue shown before the scenario starts. */
  prologText: string;
  /** Cinematic/epilogue shown after the scenario is won. */
  epilogText: string;
}

export interface CampaignParseResult {
  ok: true;
  version: CampaignVersionId;
  /** Just for HotA: the format-version sub-revision (1 = 1.7.0, 2 = 1.7.3, 3 = 1.8.0). */
  hotaFormatVersion: number | null;
  /** Region map index — picks which background art VCMI uses. */
  campaignRegionId: number;
  name: string;
  description: string;
  /** Whether the player is allowed to pick the difficulty (post-RoE). */
  difficultyChosenByPlayer: boolean;
  /** Music track index for the campaign theme. */
  music: number;
  scenarios: CampaignScenario[];
}

export type CampaignParseError = { ok: false; error: string };

export function parseH3c(
  raw: Uint8Array
): CampaignParseResult | CampaignParseError {
  if (raw.length < 8) return { ok: false, error: "file too small" };

  const reader = new BinaryReader(raw);
  const versionMagic = reader.u32le();
  const version = campaignVersionLabel(versionMagic);
  if (!version) {
    return {
      ok: false,
      error: `unrecognized campaign magic 0x${versionMagic
        .toString(16)
        .padStart(8, "0")}`,
    };
  }

  let hotaFormatVersion: number | null = null;
  let numberOfScenarios = 0;

  // HotA campaigns have a variable-length prefix between the version
  // magic and the rest of the header.
  let campaignRegionId = 0;
  let name = "";
  if (version === "HotA") {
    hotaFormatVersion = reader.u32le() | 0;
    if (hotaFormatVersion === 2) {
      // hotaVersion: major + minor + patch + bool forceMatching
      reader.u32le();
      reader.u32le();
      reader.u32le();
      reader.bool();
    } else if (hotaFormatVersion === 3) {
      // 1.8.0+: extra fields not yet reverse-engineered. The first 12
      // bytes after formatVersion appear to be fixed (`01 00 00 00 08
      // 00 00 00 00 00 00 00`) followed by version-specific data.
      // Until we crack the layout we treat these as unparseable.
      return {
        ok: false,
        error: `HotA campaign formatVersion ${hotaFormatVersion} not yet supported`,
      };
    }

    reader.u8(); // unknownB (asserted == 1)
    reader.u32le(); // unknownC (VCMI says == 0 but in the wild varies)
    numberOfScenarios = reader.u32le() | 0;
    if (numberOfScenarios < 0 || numberOfScenarios > 64) {
      return {
        ok: false,
        error: `implausible scenario count: ${numberOfScenarios}`,
      };
    }
    campaignRegionId = reader.u8();
    name = reader.string();
  } else {
    campaignRegionId = reader.u8();
    name = reader.string();
  }

  // For non-HotA we already deferred reading `name` to here. For HotA
  // we already consumed name inside tryHotaHeader; reader.offset now
  // points at the description.
  const description = reader.string();
  const difficultyChosenByPlayer =
    version === "RoE" ? false : reader.bool();
  const music = reader.u8();

  // For non-HotA campaigns, the scenario count is implied by the
  // region map (each region map has a fixed number of slots). Without
  // VCMI's region table, we read scenarios until we run out of bytes
  // or hit something implausible.
  const scenarios: CampaignScenario[] = [];
  if (version === "HotA") {
    for (let i = 0; i < numberOfScenarios; i++) {
      try {
        scenarios.push(readScenario(reader, version));
      } catch (e) {
        return {
          ok: false,
          error: `scenario ${i}: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
  } else {
    // Best-effort loop bounded by remaining bytes.
    while (reader.remaining() > 4) {
      const before = reader.offset;
      try {
        scenarios.push(readScenario(reader, version));
      } catch {
        // We hit garbage — back up and stop. The header still tells
        // a usable story even with a partial scenario list.
        reader.offset = before;
        break;
      }
      if (scenarios.length > 64) break; // sanity cap
    }
  }

  return {
    ok: true,
    version,
    hotaFormatVersion,
    campaignRegionId,
    name,
    description,
    difficultyChosenByPlayer,
    music,
    scenarios,
  };
}

function readScenario(
  reader: BinaryReader,
  version: CampaignVersionId
): CampaignScenario {
  const mapName = reader.string();
  const packedMapSize = reader.u32le();

  // numberOfScenarios > 8 means "unholy alliance"-style map with u16
  // precondition mask. We don't have that count here in non-HotA
  // (it's derived from the region table), so we conservatively use
  // u8 — the only campaigns with > 8 scenarios in the official set
  // are HotA, which is already handled below, plus a few mods.
  reader.u8(); // preconditionRegions u8

  const regionColor = reader.u8();
  const difficulty = reader.u8();

  const regionText = reader.string();
  const prologText = readPrologEpilog(reader);

  // HotA scenarios add 2 extra prolog blocks and 2 extra epilog blocks
  // (presumably for branching narrative). We skip the bodies but
  // collect the first ones for display.
  if (version === "HotA") {
    readPrologEpilog(reader); // prolog2
    readPrologEpilog(reader); // prolog3
  }

  const epilogText = readPrologEpilog(reader);

  if (version === "HotA") {
    readPrologEpilog(reader); // epilog2
    readPrologEpilog(reader); // epilog3
  }

  // Travel options — we read but don't expose. Walking past these is
  // necessary to land on the next scenario.
  readTravelOptions(reader, version);

  return {
    mapName,
    packedMapSize,
    regionColor,
    difficulty,
    regionText,
    prologText,
    epilogText,
  };
}

function readPrologEpilog(reader: BinaryReader): string {
  const has = reader.bool();
  if (!has) return "";
  reader.u8(); // prologVideo
  reader.u8(); // prologMusic
  return reader.string();
}

function readTravelOptions(
  reader: BinaryReader,
  version: CampaignVersionId
): void {
  reader.u8(); // whatHeroKeeps bitmask

  // monstersKeptByHero + artifactsKeptByHero bitmask sizes:
  if (version === "HotA") {
    reader.skip(24); // monsters
    reader.skip(21); // artifacts
  } else {
    reader.skip(19); // monsters
    reader.skip(version === "RoE" || version === "AB" ? 17 : 18); // artifacts
  }

  const startOptions = reader.u8(); // 0=NONE, 1=START_BONUS, 2=HERO_CROSSOVER, 3=HERO_OPTIONS

  if (startOptions === 1) {
    reader.u8(); // playerColor
  }

  if (startOptions !== 0) {
    const numBonuses = reader.u8();
    for (let i = 0; i < numBonuses; i++) {
      readBonus(reader, startOptions);
    }
  }
}

/** Per-bonus reader. Returns nothing — we just advance the cursor. */
function readBonus(reader: BinaryReader, startOptions: number): void {
  switch (startOptions) {
    case 1: {
      // START_BONUS: type-tagged
      const t = reader.u8();
      switch (t) {
        case 0: // SPELL: i16 hero + u8 spell
          reader.u16le();
          reader.u8();
          break;
        case 1: // MONSTER: i16 hero + u16 creature + u16 amount
          reader.u16le();
          reader.u16le();
          reader.u16le();
          break;
        case 2: // BUILDING: u8
          reader.u8();
          break;
        case 3: // ARTIFACT: i16 hero + u16 artifact
          reader.u16le();
          reader.u16le();
          break;
        case 4: // SPELL_SCROLL: i16 hero + u8 spell
          reader.u16le();
          reader.u8();
          break;
        case 5: // PRIMARY_SKILL: i16 hero + 4 u8
          reader.u16le();
          reader.skip(4);
          break;
        case 6: // SECONDARY_SKILL: i16 hero + u8 skill + u8 mastery
          reader.u16le();
          reader.u8();
          reader.u8();
          break;
        case 7: // RESOURCE: i8 res + i32 amount
          reader.u8();
          reader.u32le();
          break;
        default:
          throw new Error(`unknown START_BONUS subtype ${t}`);
      }
      break;
    }
    case 2: // HERO_CROSSOVER: u8 player + u8 scenarioId
      reader.u8();
      reader.u8();
      break;
    case 3: // HERO_OPTIONS: u8 player + i16 hero
      reader.u8();
      reader.u16le();
      break;
    default:
      throw new Error(`unknown startOptions ${startOptions}`);
  }
}

/** Same shape as h3m's `unwrapMapFile` flow but for raw bytes already
 * known to be a campaign descriptor. Useful from a Server Action that
 * already gunzipped the file. */
export function parseCampaignFromBytes(
  raw: Uint8Array
): CampaignParseResult | CampaignParseError {
  return parseH3c(raw);
}
