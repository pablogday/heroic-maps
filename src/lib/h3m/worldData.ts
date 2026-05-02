import { BinaryReader } from "./reader";
import type { FormatId } from "./versions";

/**
 * Walks every section of an .h3m between win/loss conditions and the
 * terrain grid. None of these sections are exposed yet — the goal is
 * to land the cursor exactly at the start of the terrain layer so a
 * future minimap renderer can read it.
 *
 * Sections (SoD/AB/RoE — HotA-specific deltas TBD):
 *   1. Team info
 *   2. Allowed heroes bitmask
 *   3. Placeholder heroes count (SoD+)
 *   4. Disposed heroes (SoD only)
 *   5. Reserved padding (31 bytes)
 *   6. Allowed artifacts (AB+)
 *   7. Allowed spells (SoD+)
 *   8. Allowed abilities (SoD+)
 *   9. Rumors (count + count * (string + string))
 *  10. Predefined hero settings (SoD+) — 156 heroes (RoE: 128)
 *
 * Cross-checked against VCMI's MapFormatH3M.cpp where possible.
 */

const ALLOWED_HEROES_BYTES = {
  RoE: 16,
  AB: 20,
  SoD: 20,
} as const;

const PREDEFINED_HERO_COUNT = {
  RoE: 0, // No predefined hero section in RoE
  AB: 156,
  SoD: 156,
} as const;

const ALLOWED_ARTIFACTS_BYTES = {
  RoE: 0, // section absent in RoE
  AB: 17,
  SoD: 18,
} as const;

type SimpleFormat = "RoE" | "AB" | "SoD";

export type WalkTrace = Array<{
  section: string;
  startOffset: number;
  endOffset: number;
  detail?: string;
}>;

export function walkToTerrain(
  reader: BinaryReader,
  format: SimpleFormat,
  trace?: WalkTrace
): void {
  step(reader, "teamInfo", trace, () => parseTeamInfo(reader));
  step(reader, "allowedHeroes", trace, () => parseAllowedHeroes(reader, format));
  step(reader, "placeholderHeroes", trace, () => parsePlaceholderHeroes(reader, format));
  step(reader, "disposedHeroes", trace, () => parseDisposedHeroes(reader, format));
  step(reader, "reserved", trace, () => reader.skip(31));
  step(reader, "allowedArtifacts", trace, () => parseAllowedArtifacts(reader, format));
  step(reader, "allowedSpellsAndAbilities", trace, () => parseAllowedSpellsAndAbilities(reader, format));
  step(reader, "rumors", trace, () => parseRumors(reader));
  step(reader, "predefinedHeroes", trace, () => parsePredefinedHeroes(reader, format));
}

function step(
  reader: BinaryReader,
  name: string,
  trace: WalkTrace | undefined,
  fn: () => void
): void {
  const start = reader.offset;
  try {
    fn();
  } catch (e) {
    if (trace) {
      trace.push({
        section: name,
        startOffset: start,
        endOffset: reader.offset,
        detail: `THREW: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    throw e;
  }
  if (trace) {
    trace.push({
      section: name,
      startOffset: start,
      endOffset: reader.offset,
    });
  }
}

function parseTeamInfo(reader: BinaryReader): void {
  const teamCount = reader.u8();
  if (teamCount > 0) {
    reader.skip(8); // one byte per player slot
  }
}

function parseAllowedHeroes(reader: BinaryReader, format: SimpleFormat): void {
  reader.skip(ALLOWED_HEROES_BYTES[format]);
}

function parsePlaceholderHeroes(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  if (format === "RoE") return;
  const count = reader.u32le();
  reader.skip(count); // each is u8 heroId
}

function parseDisposedHeroes(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  if (format !== "SoD") return;
  const count = reader.u8();
  for (let i = 0; i < count; i++) {
    reader.u8(); // heroId
    reader.u8(); // portrait
    reader.string(); // name
    reader.u8(); // players (bitmask)
  }
}

function parseAllowedArtifacts(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  reader.skip(ALLOWED_ARTIFACTS_BYTES[format]);
}

function parseAllowedSpellsAndAbilities(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  if (format === "RoE" || format === "AB") return;
  reader.skip(9); // allowed spells (bitmask: 9 bytes covers 70 spells)
  reader.skip(4); // allowed secondary abilities (4 bytes covers 28 skills)
}

function parseRumors(reader: BinaryReader): void {
  const count = reader.u32le();
  for (let i = 0; i < count; i++) {
    reader.string(); // name
    reader.string(); // body
  }
}

function parsePredefinedHeroes(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  const heroCount = PREDEFINED_HERO_COUNT[format];
  for (let i = 0; i < heroCount; i++) {
    parseOnePredefinedHero(reader, format);
  }
}

function parseOnePredefinedHero(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  const hasCustomData = reader.bool();
  if (!hasCustomData) return;

  const hasExperience = reader.bool();
  if (hasExperience) reader.u32le();

  const hasSecondarySkills = reader.bool();
  if (hasSecondarySkills) {
    const numSkills = reader.u32le();
    reader.skip(numSkills * 2); // u8 skillId + u8 level
  }

  const hasArtifacts = reader.bool();
  if (hasArtifacts) {
    parseHeroArtifacts(reader, format);
  }

  const hasBio = reader.bool();
  if (hasBio) reader.string();

  reader.u8(); // sex (0xff = default)

  const hasSpells = reader.bool();
  if (hasSpells) reader.skip(9); // spell bitmask

  const hasPrimarySkills = reader.bool();
  if (hasPrimarySkills) reader.skip(4); // attack, defense, spellpower, knowledge
}

/**
 * Hero artifact slots: 13 body slots + 4 war machine slots + 1
 * spellbook + (SoD only) 1 misc5 = 18 for AB/RoE, 19 for SoD.
 * Then a u16-prefixed backpack of variable length. Each artifact id
 * is u8 (RoE) or u16 (AB+).
 */
function parseHeroArtifacts(
  reader: BinaryReader,
  format: SimpleFormat
): void {
  const idBytes = format === "RoE" ? 1 : 2;
  const fixedSlots = format === "SoD" ? 19 : 18;
  reader.skip(fixedSlots * idBytes);
  const backpackCount = reader.u16le();
  reader.skip(backpackCount * idBytes);
}
