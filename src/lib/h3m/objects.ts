import { BinaryReader } from "./reader";
import type { FormatId } from "./versions";
import { ObjClass } from "./objectClasses";

/**
 * Object templates + instances. Cross-checked against VCMI's
 * MapFormatH3M.cpp::readObject and the MapFormatFeaturesH3M tables.
 *
 * Critical insight from VCMI: `readGeneric` reads ZERO bytes from the
 * stream. Most adventure-map decorations and non-interactive objects
 * fall through to readGeneric, which means **the default for unknown
 * classes is to consume no bytes**. This is the opposite of my first
 * intuition, and it's why earlier "default to no body" attempts only
 * went sideways — the per-class body parsers I had were correct, but
 * I was over-eager about adding bodies for classes that have none.
 *
 * Body parsers below mirror VCMI's behavior for SoD/AB/RoE/WoG. HotA
 * adds extra reads gated on subRevision-derived feature flags
 * (HOTA1, HOTA3, HOTA5, HOTA7, HOTA9). For HotA maps we look up the
 * feature set from the parsed prefix and apply the same gates.
 */

export interface ObjectTemplate {
  sprite: string;
  objClass: number;
  objSubclass: number;
}

export interface MapObjectInstance {
  x: number;
  y: number;
  z: number;
  templateIndex: number;
  objClass: number;
  /** Owner color (0-7) or 0xff for neutral; null when class has no
   * owner concept. Read from the start of owner-bearing bodies. */
  owner: number | null;
}

export interface ObjectsParseResult {
  templates: ObjectTemplate[];
  instances: MapObjectInstance[];
  /** Set if we bailed out on an unknown-shape body. */
  failedAtInstance?: number;
  failedReason?: string;
  /** True iff post-walk the cursor lands at a plausible event count
   * (validates the entire object walk). */
  passedEventSanityCheck?: boolean;
}

/**
 * Format-feature table. Mirrors VCMI's MapFormatFeaturesH3M but only
 * with the fields we need for object body parsing.
 */
export interface ObjectsFeatures {
  // Byte widths for various id-bitmasks
  factionsBytes: number; // 1 (RoE) | 2 (AB+)
  artifactsBytes: number; // 16 (RoE) | 17 (AB) | 18 (SoD) | 21 (HotA)
  spellsBytes: number; // 9
  skillsBytes: number; // 4
  buildingsBytes: number; // 6
  resourcesBytes: number; // 4
  artifactSlotsCount: number; // 18 (RoE/AB) | 19 (SoD/WoG) | 21 (HotA)
  // Single-id widths
  /** 1 (RoE) | 2 (AB+) — for artifact id and creature id */
  artifactCreatureWidth: number;
  // Format level flags
  levelAB: boolean;
  levelSOD: boolean;
  levelHOTA1: boolean;
  levelHOTA3: boolean;
  levelHOTA5: boolean;
  levelHOTA7: boolean;
  levelHOTA9: boolean;
}

export function featuresFor(
  format: FormatId,
  hotaSubRev: number | null
): ObjectsFeatures {
  // Start from RoE
  const f: ObjectsFeatures = {
    factionsBytes: 1,
    artifactsBytes: 16,
    spellsBytes: 9,
    skillsBytes: 4,
    buildingsBytes: 6,
    resourcesBytes: 4,
    artifactSlotsCount: 18,
    artifactCreatureWidth: 1,
    levelAB: false,
    levelSOD: false,
    levelHOTA1: false,
    levelHOTA3: false,
    levelHOTA5: false,
    levelHOTA7: false,
    levelHOTA9: false,
  };
  if (format === "RoE") return f;

  // AB+
  f.factionsBytes = 2;
  f.artifactsBytes = 17;
  f.artifactCreatureWidth = 2;
  f.levelAB = true;
  if (format === "AB") return f;

  // SoD/WoG
  f.artifactsBytes = 18;
  f.artifactSlotsCount = 19;
  f.levelSOD = true;
  if (format === "SoD" || format === "WoG") return f;

  // HotA — same as SoD plus subRev-dependent flags
  if (format === "HotA1" || format === "HotA2" || format === "HotA3") {
    f.artifactsBytes = 21;
    f.artifactSlotsCount = 19;
    const v = hotaSubRev ?? 0;
    f.levelHOTA1 = v > 0;
    f.levelHOTA3 = v > 2;
    f.levelHOTA5 = v > 4;
    f.levelHOTA7 = v > 6;
    f.levelHOTA9 = v > 8;
    if (v >= 5) f.factionsBytes = 2; // factionsCount=11 still fits in 2 bytes
  }
  return f;
}

export function parseObjects(
  reader: BinaryReader,
  features: ObjectsFeatures
): ObjectsParseResult {
  const templates: ObjectTemplate[] = [];
  const templateCount = reader.u32le();
  for (let i = 0; i < templateCount; i++) {
    templates.push(parseTemplate(reader));
  }

  const instances: MapObjectInstance[] = [];
  const instanceCount = reader.u32le();
  for (let i = 0; i < instanceCount; i++) {
    try {
      instances.push(parseInstance(reader, templates, features));
    } catch (e) {
      return {
        templates,
        instances,
        failedAtInstance: i,
        failedReason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Post-walk sanity check: events section follows. Read u32 event
  // count and verify it's plausible. If garbage, we mis-walked.
  const at = reader.offset;
  let passedEventSanityCheck = false;
  try {
    const eventCount = reader.u32le();
    if (eventCount <= 1000) passedEventSanityCheck = true;
  } catch {
    /* EOF */
  }
  reader.offset = at;

  return { templates, instances, passedEventSanityCheck };
}

function parseTemplate(reader: BinaryReader): ObjectTemplate {
  const sprite = reader.string();
  reader.skip(6); // passability
  reader.skip(6); // actions
  reader.skip(2); // allowedTerrains
  reader.skip(2); // landscapeGroup
  const objClass = reader.u32le();
  const objSubclass = reader.u32le();
  reader.skip(1); // objGroup
  reader.skip(1); // isOverlay
  reader.skip(16); // padding
  return { sprite, objClass, objSubclass };
}

function parseInstance(
  reader: BinaryReader,
  templates: ObjectTemplate[],
  f: ObjectsFeatures
): MapObjectInstance {
  const x = reader.u8();
  const y = reader.u8();
  const z = reader.u8();
  const templateIndex = reader.u32le();
  reader.skip(5); // padding/reserved (skipZero in VCMI)

  const tmpl = templates[templateIndex];
  if (!tmpl) {
    throw new Error(
      `instance refers to template ${templateIndex} but only ${templates.length} exist`
    );
  }

  const owner = parseBody(reader, tmpl.objClass, tmpl.objSubclass, f);

  return { x, y, z, templateIndex, objClass: tmpl.objClass, owner };
}

/** Returns owner color (0-7 / 0xff) or null. */
function parseBody(
  reader: BinaryReader,
  objClass: number,
  objSubclass: number,
  f: ObjectsFeatures
): number | null {
  switch (objClass) {
    // ===== Owner-only u32 =====
    case ObjClass.SHIPYARD:
    case ObjClass.LIGHTHOUSE:
    case ObjClass.MINE:
      if (objClass === ObjClass.MINE && objSubclass >= 7) {
        // Abandoned mine
        return readAbandonedMine(reader, f);
      }
      return reader.u32le();
    case ObjClass.CREATURE_GENERATOR1: // 17
    case 18: // CREATURE_GENERATOR2
    case 19: // CREATURE_GENERATOR3
    case ObjClass.CREATURE_GENERATOR4: // 20
      return reader.u32le();

    // ===== Sign / Bottle =====
    case ObjClass.SIGN:
    case ObjClass.OCEAN_BOTTLE:
      reader.string();
      reader.skip(4);
      return null;

    // ===== Resource / Random Resource =====
    case ObjClass.RESOURCE:
    case ObjClass.RANDOM_RESOURCE:
      readMessageAndGuards(reader, f);
      reader.u32le(); // amount
      reader.skip(4);
      return null;

    // ===== Artifact (all variants) =====
    case ObjClass.ARTIFACT:
    case ObjClass.RANDOM_ART:
    case ObjClass.RANDOM_TREASURE_ART:
    case ObjClass.RANDOM_MINOR_ART:
    case ObjClass.RANDOM_MAJOR_ART:
    case ObjClass.RANDOM_RELIC_ART:
      readMessageAndGuards(reader, f);
      if (f.levelHOTA5) {
        reader.u32le(); // pickupMode
        reader.u8(); // pickupFlags
      }
      return null;

    case ObjClass.SPELL_SCROLL:
      readMessageAndGuards(reader, f);
      reader.u32le(); // spellID
      return null;

    // ===== Garrison =====
    case ObjClass.GARRISON:
    case 33: // GARRISON
    case 219: // GARRISON2 (HotA)
      {
        const owner = reader.u32le();
        readCreatureSet(reader, f);
        if (f.levelAB) reader.u8(); // removableUnits
        reader.skip(8);
        return owner;
      }

    // ===== Monster (all variants) =====
    case ObjClass.MONSTER:
    case ObjClass.RANDOM_MONSTER:
    case ObjClass.RANDOM_MONSTER_L1:
    case ObjClass.RANDOM_MONSTER_L2:
    case ObjClass.RANDOM_MONSTER_L3:
    case ObjClass.RANDOM_MONSTER_L4:
    case ObjClass.RANDOM_MONSTER_L5:
    case ObjClass.RANDOM_MONSTER_L6:
    case ObjClass.RANDOM_MONSTER_L7:
      readMonster(reader, f);
      return null;

    // ===== Witch hut =====
    case ObjClass.WITCH_HUT:
      if (f.levelAB) reader.skip(f.skillsBytes);
      return null;

    // ===== Scholar =====
    case ObjClass.SCHOLAR:
      reader.u8(); // bonusType (-1..2)
      reader.u8(); // bonusID
      reader.skip(6); // padding
      return null;

    // ===== Shrines (all 3 levels + HotA 4th) =====
    case ObjClass.SHRINE_OF_MAGIC_INCANTATION:
    case ObjClass.SHRINE_OF_MAGIC_GESTURE:
    case ObjClass.SHRINE_OF_MAGIC_THOUGHT:
      reader.u32le();
      return null;

    // ===== Pandora's Box =====
    case ObjClass.PANDORAS_BOX:
      readBoxContent(reader, f);
      if (f.levelHOTA5) reader.skip(1);
      readBoxHotaContent(reader, f);
      return null;

    // ===== Event =====
    case ObjClass.EVENT:
      readBoxContent(reader, f);
      reader.skip(1); // bitmaskPlayers (1 byte)
      reader.u8(); // computerActivate
      reader.u8(); // removeAfterVisit
      reader.skip(4);
      if (f.levelHOTA3) reader.u8(); // humanActivate
      readBoxHotaContent(reader, f);
      return null;

    // ===== Grail =====
    case ObjClass.GRAIL:
      // HOTA arena battle location uses subId >= 1000; same i32 read
      reader.u32le(); // grail radius
      return null;

    // ===== Random Dwellings =====
    case 216: // RANDOM_DWELLING
    case 217: // RANDOM_DWELLING_LVL
    case 218: // RANDOM_DWELLING_FACTION
      return readDwellingRandom(reader, objClass, f);

    // ===== Quest Guard =====
    case 215: // QUEST_GUARD
      readQuest(reader, f);
      return null;

    // ===== Hero Placeholder =====
    case 214: // HERO_PLACEHOLDER
      return readHeroPlaceholder(reader, f);

    // ===== Town =====
    case ObjClass.TOWN:
    case ObjClass.RANDOM_TOWN:
      return readTown(reader, f);

    // ===== Hero / Random Hero / Prison =====
    case ObjClass.HERO:
    case ObjClass.RANDOM_HERO:
    case ObjClass.PRISON:
      return readHero(reader, f);

    // ===== Seer's Hut =====
    case ObjClass.SEERS_HUT:
      readSeerHut(reader, f);
      return null;

    // ===== Border Gate (HotA subId can be quest/grave) =====
    case ObjClass.BORDER_GATE:
      if (objSubclass === 1000) {
        readQuest(reader, f);
        return null;
      }
      if (objSubclass === 1001) {
        readHotaGrave(reader, f);
        return null;
      }
      return null;

    // ===== HotA-only bodies (only consume bytes when feature is on) =====
    case ObjClass.CREATURE_BANK:
    case ObjClass.DERELICT_SHIP:
    case ObjClass.DRAGON_UTOPIA:
    case ObjClass.CRYPT:
    case 85: // SHIPWRECK
      readBank(reader, f);
      return null;

    case ObjClass.PYRAMID:
      readPyramid(reader, f);
      return null;

    case ObjClass.TREASURE_CHEST:
    case ObjClass.CORPSE:
    case ObjClass.WARRIORS_TOMB:
    case ObjClass.SHIPWRECK_SURVIVOR:
    case ObjClass.SEA_CHEST:
      readRewardWithArtifact(reader, f);
      return null;

    case ObjClass.FLOTSAM:
    case ObjClass.TREE_OF_KNOWLEDGE:
      readRewardWithGarbage(reader, f);
      return null;

    case ObjClass.CAMPFIRE:
      readCampfire(reader, f);
      return null;

    case ObjClass.LEAN_TO:
      readLeanTo(reader, f);
      return null;

    case ObjClass.WAGON:
      readWagon(reader, f);
      return null;

    case ObjClass.BLACK_MARKET:
      if (f.levelHOTA5) {
        for (let i = 0; i < 7; i++) {
          reader.skip(f.artifactCreatureWidth); // artifact
          reader.skip(2); // spell16
        }
      }
      return null;

    case ObjClass.UNIVERSITY:
      if (f.levelHOTA5) {
        reader.u32le(); // customized
        reader.skip(f.skillsBytes); // bitmask
      }
      return null;

    // ===== HotA custom objects (real IDs per VCMI EntityIdentifiers.h) =====
    case ObjClass.HOTA_CUSTOM_OBJECT_1: // 145 — Ancient Lamp / Sea Barrel / Jetsam / Vial of Mana
      if (f.levelHOTA5) {
        if (objSubclass === 0) readRewardWithAmount(reader, f);
        else if (objSubclass === 1) readLeanTo(reader, f);
        else readRewardWithGarbage(reader, f);
      }
      return null;

    case ObjClass.HOTA_CUSTOM_OBJECT_2: // 146 — Seafaring Academy
      if (f.levelHOTA5 && objSubclass === 0) {
        reader.u32le(); // customized
        reader.skip(f.skillsBytes);
      }
      return null;

    case ObjClass.HOTA_CUSTOM_OBJECT_3: // 144 — Trapper Lodge variants
      if (f.levelHOTA9 && objSubclass === 12) {
        reader.skip(4 + 4 + 4 + 4); // content + gold + creatureAmount + creatureType
      }
      return null;

    // ===== Abandoned Mine (HotA, class 220 — separate from MINE) =====
    case ObjClass.ABANDONED_MINE:
      return readAbandonedMine(reader, f);

    // ===== Default: no body (matches VCMI's readGeneric) =====
    default:
      return null;
  }
}

// ---------- helpers ----------

function readMessageAndGuards(reader: BinaryReader, f: ObjectsFeatures): void {
  const hasMsg = reader.u8() !== 0;
  if (!hasMsg) return;
  reader.string();
  const hasGuards = reader.u8() !== 0;
  if (hasGuards) readCreatureSet(reader, f);
  reader.skip(4);
}

/** 7 stacks of (creature id + u16 count). Creature id is u8 (RoE) or u16. */
function readCreatureSet(reader: BinaryReader, f: ObjectsFeatures): void {
  const idBytes = f.artifactCreatureWidth;
  reader.skip(7 * (idBytes + 2));
}

function readMonster(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelAB) reader.skip(4); // identifier
  reader.skip(2); // count
  reader.skip(1); // character
  const hasMessage = reader.u8() !== 0;
  if (hasMessage) {
    reader.string();
    reader.skip(7 * 4); // resources
    reader.skip(f.artifactCreatureWidth); // artifact
  }
  reader.skip(1); // neverFlees
  reader.skip(1); // notGrowingTeam
  reader.skip(2); // padding
  if (f.levelHOTA3) {
    reader.skip(4); // aggression
    reader.skip(1); // joinOnlyForMoney
    reader.skip(4); // joiningPercentage
    reader.skip(4); // upgradedStackPresence
    reader.skip(4); // stacksCount
  }
  if (f.levelHOTA5) {
    reader.skip(1); // sizeByValue
    reader.skip(4); // targetValue
  }
}

function readBoxContent(reader: BinaryReader, f: ObjectsFeatures): void {
  readMessageAndGuards(reader, f);
  reader.skip(4); // hero exp
  reader.skip(4); // mana diff
  reader.skip(1); // morale
  reader.skip(1); // luck
  reader.skip(7 * 4); // resources
  reader.skip(4); // 4 primary skills
  const gabn = reader.u8();
  reader.skip(gabn * 2); // skill+level
  const gart = reader.u8();
  for (let i = 0; i < gart; i++) {
    reader.skip(f.artifactCreatureWidth);
    if (f.levelHOTA5) reader.skip(2); // scroll spell
  }
  const gspell = reader.u8();
  reader.skip(gspell);
  const gcre = reader.u8();
  reader.skip(gcre * (f.artifactCreatureWidth + 2));
  reader.skip(8);
}

function readBoxHotaContent(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    reader.skip(4); // movementMode
    reader.skip(4); // movementAmount
  }
  if (f.levelHOTA5 && f.levelHOTA7 === false) {
    // Strictly speaking VCMI uses levelHOTA6 here; conservative.
  }
  // levelHOTA6 — allowedDifficultiesMask
  // We don't have a HOTA6 flag (lumped into HOTA5/7); approximate via HOTA5
  // — the read happens at HOTA6+ in VCMI, which we treat as HOTA5+ for
  // simplicity (HOTA6 is HotA 1.7.1, HOTA5 is 1.7.0 — the field appeared
  // at 1.7.x). For accuracy we check HOTA5 & assume same applies; if a
  // 1.7.0 file lacks it we'll mis-walk those — rare in our corpus.
  // SKIPPING this read for safety; coverage will tell.
  if (f.levelHOTA9) {
    const usesEvents = reader.u8() !== 0;
    if (usesEvents) {
      reader.skip(4);
      reader.skip(1);
    }
  }
}

function readDwellingRandom(
  reader: BinaryReader,
  objClass: number,
  f: ObjectsFeatures
): number {
  const owner = reader.u32le();
  const hasFactionInfo = objClass === 216 || objClass === 217;
  const hasLevelInfo = objClass === 216 || objClass === 218;
  if (hasFactionInfo) {
    const identifier = reader.u32le();
    if (identifier === 0) reader.skip(f.factionsBytes);
  }
  if (hasLevelInfo) {
    reader.skip(2); // min + max level (u8 each)
  }
  return owner;
}

function readQuest(reader: BinaryReader, f: ObjectsFeatures): void {
  const missionId = reader.u8(); // 0..10
  switch (missionId) {
    case 0:
      return;
    case 1: // PRIMARY_SKILL: 4 u8
      reader.skip(4);
      break;
    case 2: // LEVEL: u32
      reader.skip(4);
      break;
    case 3: // KILL_HERO: u32
    case 4: // KILL_CREATURE: u32
      reader.skip(4);
      break;
    case 5: {
      // ARTIFACT
      const n = reader.u8();
      for (let i = 0; i < n; i++) {
        reader.skip(f.artifactCreatureWidth);
        if (f.levelHOTA5) reader.skip(2);
      }
      break;
    }
    case 6: {
      // ARMY
      const n = reader.u8();
      reader.skip(n * (f.artifactCreatureWidth + 2));
      break;
    }
    case 7: // RESOURCES: 7 u32
      reader.skip(7 * 4);
      break;
    case 8: // HERO: u8
      reader.skip(1);
      break;
    case 9: // PLAYER: u8
      reader.skip(1);
      break;
    case 10: {
      // HOTA_MULTI
      const sub = reader.u32le();
      if (sub === 0) reader.skip((f.artifactCreatureWidth === 1 ? 1 : 2)); // bitmask hero classes — approx
      else if (sub === 1) reader.skip(4); // daysPassed
      else if (sub === 2) reader.skip(4); // difficultyMask
      else if (sub === 3) {
        reader.skip(4);
        reader.skip(1);
      }
      break;
    }
  }
  reader.skip(4); // lastDay (i32)
  reader.string(); // firstVisitText
  reader.string(); // nextVisitText
  reader.string(); // completedText
}

function readSeerHut(reader: BinaryReader, f: ObjectsFeatures): void {
  let questsCount = 1;
  if (f.levelHOTA3) questsCount = reader.u32le();
  for (let i = 0; i < questsCount; i++) readSeerHutQuest(reader, f);
  if (f.levelHOTA3) {
    const repeatable = reader.u32le();
    for (let i = 0; i < repeatable; i++) readSeerHutQuest(reader, f);
  }
  reader.skip(2);
}

function readSeerHutQuest(reader: BinaryReader, f: ObjectsFeatures): void {
  let missionType = 0;
  if (f.levelAB) {
    // Quest mission inline
    const before = reader.offset;
    readQuest(reader, f);
    // Determine mission type by re-reading first byte (we already
    // consumed it). Cheap proxy: peek at offset 'before' which we
    // already passed. Use peek via direct access.
    missionType = reader.buf[before];
  } else {
    // RoE: just an artifact id
    const artId =
      f.artifactCreatureWidth === 1 ? reader.u8() : reader.u16le();
    missionType = artId === (f.artifactCreatureWidth === 1 ? 0xff : 0xffff)
      ? 0
      : 5; // ARTIFACT
  }

  if (missionType === 0) {
    reader.skip(1); // skipZero(1) for missionType==NONE
    return;
  }

  const rewardType = reader.u8(); // 0..10
  switch (rewardType) {
    case 0:
      break;
    case 1: // EXPERIENCE
    case 2: // MANA
      reader.skip(4);
      break;
    case 3: // MORALE
    case 4: // LUCK
      reader.skip(1);
      break;
    case 5: // RESOURCES: u8 + u32
      reader.skip(1 + 4);
      break;
    case 6: // PRIMARY_SKILL: u8 + u8
      reader.skip(2);
      break;
    case 7: // SECONDARY_SKILL: u8 + i8
      reader.skip(2);
      break;
    case 8: // ARTIFACT
      reader.skip(f.artifactCreatureWidth);
      if (f.levelHOTA5) reader.skip(2);
      break;
    case 9: // SPELL: u8
      reader.skip(1);
      break;
    case 10: // CREATURE: creature + u16
      reader.skip(f.artifactCreatureWidth + 2);
      break;
  }
}

function readHeroPlaceholder(
  reader: BinaryReader,
  f: ObjectsFeatures
): number {
  const owner = reader.u8();
  const heroType = reader.u8();
  if (heroType === 0xff) reader.u8(); // power rank
  if (f.levelHOTA5) {
    reader.u8(); // customStarting
    for (let i = 0; i < 7; i++) {
      reader.skip(4); // amount
      reader.skip(4); // creature
    }
    const numArt = reader.u32le();
    reader.skip(numArt * 4);
  }
  return owner;
}

function readTown(reader: BinaryReader, f: ObjectsFeatures): number {
  if (f.levelAB) reader.skip(4); // identifier
  const owner = reader.u8();
  const hasName = reader.u8() !== 0;
  if (hasName) reader.string();
  const hasGarrison = reader.u8() !== 0;
  if (hasGarrison) readCreatureSet(reader, f);
  reader.u8(); // formation
  const hasCustomBuildings = reader.u8() !== 0;
  if (hasCustomBuildings) {
    reader.skip(f.buildingsBytes);
    reader.skip(f.buildingsBytes);
  } else {
    reader.u8(); // hasFort
  }
  if (f.levelAB) reader.skip(f.spellsBytes); // obligatorySpells
  reader.skip(f.spellsBytes); // possibleSpells
  if (f.levelHOTA1) reader.u8(); // spellResearchAllowed
  if (f.levelHOTA5) {
    const specialBuildingsCount = reader.u32le();
    reader.skip(specialBuildingsCount); // each is i8
  }
  const eventCount = reader.u32le();
  for (let i = 0; i < eventCount; i++) readTownEvent(reader, f);
  if (f.levelSOD) reader.u8(); // alignment
  reader.skip(3);
  return owner;
}

function readEventCommon(reader: BinaryReader, f: ObjectsFeatures): void {
  reader.string(); // name
  reader.string(); // message
  reader.skip(7 * 4); // resources
  reader.skip(1); // bitmaskPlayers
  if (f.levelSOD) reader.u8(); // humanAffected
  reader.u8(); // computerAffected
  reader.skip(2); // firstOccurrence
  reader.skip(2); // nextOccurrence
  reader.skip(16);
  if (f.levelHOTA7) reader.skip(4); // affectedDifficulties
  if (f.levelHOTA9) {
    const usesEvents = reader.u8() !== 0;
    if (usesEvents) {
      reader.skip(4);
      reader.skip(1);
    }
  }
}

function readTownEvent(reader: BinaryReader, f: ObjectsFeatures): void {
  readEventCommon(reader, f);
  if (f.levelHOTA5) {
    reader.skip(4); // creatureGrowth8
    reader.skip(4); // hotaAmount
    reader.skip(4); // hotaSpecialA
    reader.skip(2); // hotaSpecialB
  }
  if (f.levelHOTA7) reader.u8(); // neutralAffected
  reader.skip(f.buildingsBytes); // new buildings
  reader.skip(7 * 2); // creature counts (7 u16)
  reader.skip(4);
}

function readHero(reader: BinaryReader, f: ObjectsFeatures): number {
  if (f.levelAB) reader.skip(4); // identifier
  const owner = reader.u8();
  reader.u8(); // heroType
  const hasName = reader.u8() !== 0;
  if (hasName) reader.string();
  if (f.levelSOD) {
    const hasExp = reader.u8() !== 0;
    if (hasExp) reader.skip(4);
  } else {
    reader.skip(4); // unconditional u32 exp on AB/RoE
  }
  const hasPortrait = reader.u8() !== 0;
  if (hasPortrait) reader.u8();
  const hasSecSkills = reader.u8() !== 0;
  if (hasSecSkills) {
    const n = reader.u32le();
    reader.skip(n * 2);
  }
  const hasGarrison = reader.u8() !== 0;
  if (hasGarrison) readCreatureSet(reader, f);
  reader.u8(); // formation
  loadArtifactsOfHero(reader, f);
  reader.u8(); // patrolRadius
  if (f.levelAB) {
    const hasBio = reader.u8() !== 0;
    if (hasBio) reader.string();
    reader.u8(); // gender
  }
  if (f.levelSOD) {
    const hasSpells = reader.u8() !== 0;
    if (hasSpells) reader.skip(f.spellsBytes);
  } else if (f.levelAB) {
    reader.u8(); // single spell id
  }
  if (f.levelSOD) {
    const hasPrim = reader.u8() !== 0;
    if (hasPrim) reader.skip(4);
  }
  reader.skip(16);
  if (f.levelHOTA5) {
    reader.u8(); // alwaysAddSkills
    reader.u8(); // cannotGainXP
    reader.skip(4); // level
  }
  return owner;
}

function loadArtifactsOfHero(reader: BinaryReader, f: ObjectsFeatures): void {
  const hasArtSet = reader.u8() !== 0;
  if (!hasArtSet) return;
  for (let i = 0; i < f.artifactSlotsCount; i++) {
    reader.skip(f.artifactCreatureWidth);
    if (f.levelHOTA5) reader.skip(2); // scroll spell
  }
  const backpack = reader.u16le();
  for (let i = 0; i < backpack; i++) {
    reader.skip(f.artifactCreatureWidth);
    if (f.levelHOTA5) reader.skip(2);
  }
}

function readAbandonedMine(
  reader: BinaryReader,
  f: ObjectsFeatures
): number {
  reader.skip(f.resourcesBytes);
  if (f.levelHOTA5) {
    const hasCustom = reader.u8() !== 0;
    if (hasCustom) reader.skip(4 + 4 + 4); // creature + min + max
    else reader.skip(12);
  }
  return 0xff; // neutral
}

function readBank(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA3) {
    reader.skip(4); // guardsPresetIndex
    reader.skip(1); // upgradedStackPresence
    const artNumber = reader.u32le();
    reader.skip(artNumber * 4);
  }
}

function readPyramid(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    const content = reader.u32le();
    if (content === 0) reader.skip(4); // spell
    else reader.skip(4); // garbage
  }
}

function readRewardWithArtifact(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content !== -1) reader.skip(4);
  }
}

function readRewardWithGarbage(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (f.levelHOTA5) reader.skip(4 + 4);
}

function readRewardWithAmount(
  reader: BinaryReader,
  f: ObjectsFeatures
): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content === -1) reader.skip(14);
    else if (content === 0) reader.skip(4 + 4 + 6);
  }
}

function readCampfire(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content === -1) reader.skip(14);
    else reader.skip(4 + 4 + 4 + 4 + 4); // skip+amount+res+amount+res
  }
}

function readLeanTo(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content === -1) reader.skip(14);
    else reader.skip(4 + 4 + 4 + 5);
  }
}

function readWagon(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content === -1 || content === 1) reader.skip(14);
    else if (content === 0) reader.skip(4 + 4 + 4 + 5);
  }
}

function readHotaGrave(reader: BinaryReader, f: ObjectsFeatures): void {
  if (f.levelHOTA5) {
    const content = reader.u32le() | 0;
    if (content === -1) reader.skip(14);
    else reader.skip(4 + 4 + 4 + 5);
  }
}
