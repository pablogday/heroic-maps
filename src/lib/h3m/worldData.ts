import { BinaryReader } from "./reader";
import type { ObjectsFeatures } from "./objects";

/**
 * Walks every section of an .h3m between win/loss conditions and the
 * terrain grid. None of these sections are exposed yet — the goal is
 * to land the cursor exactly at the start of the terrain layer so
 * the renderer can read it.
 *
 * Sections (per VCMI MapFormatH3M.cpp):
 *   1. Team info
 *   2. Allowed heroes bitmask
 *   3. Placeholder heroes count (SoD+)
 *   4. Disposed heroes (SoD only)
 *   5. Reserved padding (31 bytes)
 *   6. Allowed artifacts (AB+)
 *   7. Allowed spells (SoD+)
 *   8. Allowed abilities (SoD+)
 *   9. Rumors (count + count * (string + string))
 *  10. Predefined hero settings (SoD+) — count from features for
 *      vanilla, read u32 from stream for HotA. HotA5+ adds a second
 *      pass after the main loop.
 */

export type WalkTrace = Array<{
  section: string;
  startOffset: number;
  endOffset: number;
  detail?: string;
}>;

export function walkToTerrain(
  reader: BinaryReader,
  features: ObjectsFeatures,
  trace?: WalkTrace
): void {
  step(reader, "teamInfo", trace, () => parseTeamInfo(reader));
  step(reader, "allowedHeroes", trace, () =>
    parseAllowedHeroes(reader, features)
  );
  step(reader, "disposedHeroes", trace, () =>
    parseDisposedHeroes(reader, features)
  );
  step(reader, "mapOptions", trace, () => parseMapOptions(reader, features));
  step(reader, "hotaScripts", trace, () => parseHotaScripts(reader, features));
  step(reader, "allowedArtifacts", trace, () =>
    parseAllowedArtifacts(reader, features)
  );
  step(reader, "allowedSpellsAndAbilities", trace, () =>
    parseAllowedSpellsAndAbilities(reader, features)
  );
  step(reader, "rumors", trace, () => parseRumors(reader));
  step(reader, "predefinedHeroes", trace, () =>
    parsePredefinedHeroes(reader, features)
  );
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
    trace.push({ section: name, startOffset: start, endOffset: reader.offset });
  }
}

function parseTeamInfo(reader: BinaryReader): void {
  const teamCount = reader.u8();
  if (teamCount > 0) reader.skip(8);
}

/**
 * VCMI's readAllowedHeroes does both the bitmask AND the placeholder
 * list — they're a single section in the file. HotA uses a "sized"
 * bitmask (u32 count + dynamic bytes); pre-HotA uses a fixed width.
 */
function parseAllowedHeroes(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (f.levelHOTA0) {
    const heroesCount = reader.u32le();
    const bitmaskBytes = (heroesCount + 7) >> 3;
    reader.skip(bitmaskBytes);
  } else {
    reader.skip(f.heroesBytes);
  }
  if (f.levelAB) {
    const placeholdersCount = reader.u32le();
    reader.skip(placeholdersCount); // each is u8 heroId
  }
}

function parseDisposedHeroes(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (!f.levelSOD) return;
  const count = reader.u8();
  for (let i = 0; i < count; i++) {
    reader.u8(); // heroId
    reader.u8(); // portrait
    reader.string(); // name
    reader.u8(); // players (bitmask)
  }
}

/**
 * VCMI's readMapOptions: 31 zero bytes, then HotA-specific options.
 *   HOTA0: bool allowSpecialMonths + 3 zero bytes
 *   HOTA1: i32 combinedArtifactsCount + ((count+7)/8) bytes bitmask
 *   HOTA3: i32 roundLimit
 */
function parseMapOptions(reader: BinaryReader, f: ObjectsFeatures): void {
  reader.skip(31);
  if (f.levelHOTA0) {
    reader.bool(); // allowSpecialMonths
    reader.skip(3);
  }
  if (f.levelHOTA1) {
    const combinedArtifactsCount = reader.u32le();
    reader.skip((combinedArtifactsCount + 7) >> 3);
  }
  if (f.levelHOTA3) {
    reader.u32le(); // roundLimit
  }
  if (f.levelHOTA5) {
    // 8 bools — heroRecruitmentBlocked per player (PLAYER_LIMIT_I = 8)
    reader.skip(8);
  }
}

/**
 * VCMI's readHotaScripts: HOTA9+ only. Reads u32 scriptCount, then for
 * each: u32 nameLen + nameLen bytes (the script name) + u32 bodyLen +
 * bodyLen bytes (the script body).
 *
 * NOTE: Currently a no-op for sub-revisions below 9. If/when we hit a
 * HOTA9+ map this needs validation against real bytes.
 */
function parseHotaScripts(reader: BinaryReader, f: ObjectsFeatures): void {
  if (!f.levelHOTA9) return;
  const eventsSystemActive = reader.bool();
  if (!eventsSystemActive) return;
  // TODO(hota9): event lists with embedded script actions — not yet
  // reverse-engineered. Throwing here is a louder signal than silently
  // misaligning, and we have no HOTA9+ maps in the corpus today.
  throw new Error("HOTA9 readHotaScripts not implemented");
}

function parseAllowedArtifacts(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (!f.levelAB) return; // RoE has no allowed artifacts section
  if (f.levelHOTA0) {
    // HotA uses a sized bitmask: u32 count + dynamic bytes.
    const count = reader.u32le();
    reader.skip((count + 7) >> 3);
  } else {
    reader.skip(f.artifactsBytes);
  }
}

function parseAllowedSpellsAndAbilities(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (!f.levelSOD) return;
  reader.skip(f.spellsBytes);
  reader.skip(f.skillsBytes);
}

function parseRumors(reader: BinaryReader): void {
  const count = reader.u32le();
  for (let i = 0; i < count; i++) {
    reader.string(); // name
    reader.string(); // body
  }
}

/**
 * 156 heroes for vanilla SoD/AB, but HotA reads the count from the
 * stream first (heroesCount can be ≤ features.heroesCount). HotA5+
 * also adds a second pass after the main loop.
 */
function parsePredefinedHeroes(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (!f.levelSOD) return; // RoE / AB? AB reads hero pool too — let me check
  // VCMI: `if(!features.levelSOD) return` — predefined hero section is SoD-only.
  let heroesCount: number;
  if (f.levelHOTA0) {
    heroesCount = reader.u32le();
  } else {
    heroesCount = 156; // vanilla SoD/WoG hero count
  }

  for (let i = 0; i < heroesCount; i++) {
    parseOnePredefinedHero(reader, f);
  }

  // HotA5+ extra pass: alwaysAddSkills + cannotGainXP + level per hero
  if (f.levelHOTA5) {
    reader.skip(heroesCount * (1 + 1 + 4));
  }
}

function parseOnePredefinedHero(
  reader: BinaryReader,
  f: ObjectsFeatures
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

  // VCMI's loadArtifactsOfHero reads:
  //   bool hasArtSet
  //   if hasArtSet: artifactSlotsCount * (idBytes + (HOTA5? 2:0))
  //                 + u16 backpackSize + backpack * (idBytes + scrollBytes)
  loadArtifactsOfHero(reader, f);

  const hasBio = reader.bool();
  if (hasBio) reader.string();

  reader.u8(); // gender (0xff default, 0 male, 1 female)

  const hasSpells = reader.bool();
  if (hasSpells) reader.skip(f.spellsBytes);

  const hasPrimarySkills = reader.bool();
  if (hasPrimarySkills) reader.skip(4); // 4 primary stats
}

function loadArtifactsOfHero(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  const hasArtSet = reader.bool();
  if (!hasArtSet) return;
  const idBytes = f.artifactCreatureWidth;
  const scrollBytes = f.levelHOTA5 ? 2 : 0;
  const slotBytes = idBytes + scrollBytes;
  reader.skip(f.artifactSlotsCount * slotBytes);
  const backpackCount = reader.u16le();
  reader.skip(backpackCount * slotBytes);
}
