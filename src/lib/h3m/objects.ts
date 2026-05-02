import { BinaryReader, EofError } from "./reader";
import { ObjClass } from "./objectClasses";

/**
 * Object templates (visual / placement metadata) followed by object
 * instances on the map. After the terrain layer, the H3M lays out:
 *
 *   u32 templateCount
 *   templateCount * { sprite: string, passability: 6B,
 *                     actions: 6B, allowedTerrains: u16,
 *                     landscapeGroup: u16, objClass: u32,
 *                     objSubclass: u32, objGroup: u8,
 *                     isOverlay: u8, padding: 16B }
 *
 *   u32 instanceCount
 *   instanceCount * { pos: 3B (x,y,z), templateIndex: u32,
 *                     padding: 5B,
 *                     <class-specific body — variable length> }
 *
 * Then events follow. For each instance we look up the template's
 * objClass and dispatch to the right body parser. Unknown classes
 * cause a partial walk (we keep what we got).
 *
 * Per VCMI MapFormatH3M::readDefInfo / readObjects.
 */

type SimpleFormat = "RoE" | "AB" | "SoD";

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
  /** Copied from the resolved template for convenience. */
  objClass: number;
  /** Owner color (0–7) when applicable; 0xff = neutral. Null when
   * the class has no owner concept. */
  owner: number | null;
}

export interface ObjectsParseResult {
  templates: ObjectTemplate[];
  instances: MapObjectInstance[];
  /** Set if we bailed out on an unknown class or post-walk sanity check. */
  failedAtInstance?: number;
  failedReason?: string;
  /** True when the events-section sanity check passed — i.e. the
   * walk landed at a plausible event count after objects. Strong
   * evidence the entire object walk was correctly aligned. */
  passedEventSanityCheck?: boolean;
}

export function parseObjects(
  reader: BinaryReader,
  format: SimpleFormat
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
      instances.push(parseInstance(reader, templates, format));
    } catch (e) {
      return {
        templates,
        instances,
        failedAtInstance: i,
        failedReason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Sanity check: events section follows. Read u32 event count and
  // verify it's plausible (HoMM3 maps typically have 0–50 events,
  // hard cap a few hundred). If garbage, our walk misaligned somewhere.
  const eventsAtOffset = reader.offset;
  let passedEventSanityCheck = false;
  try {
    const eventCount = reader.u32le();
    if (eventCount <= 1000) {
      passedEventSanityCheck = true;
    }
    // Restore cursor for any future caller.
    reader.offset = eventsAtOffset;
  } catch {
    // EOF reading the count → walk consumed too much
    reader.offset = eventsAtOffset;
  }

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
  format: SimpleFormat
): MapObjectInstance {
  const x = reader.u8();
  const y = reader.u8();
  const z = reader.u8();
  const templateIndex = reader.u32le();
  reader.skip(5); // padding/reserved

  const tmpl = templates[templateIndex];
  if (!tmpl) {
    throw new Error(
      `instance refers to template ${templateIndex} but only ${templates.length} exist`
    );
  }

  const owner = parseBody(reader, tmpl.objClass, format);

  return {
    x,
    y,
    z,
    templateIndex,
    objClass: tmpl.objClass,
    owner,
  };
}

/**
 * Dispatch to a body parser for the given class id. Returns the
 * owner color when applicable, null otherwise. Throws if the class
 * is not yet supported (caller catches → partial result).
 *
 * Implementing more classes here = more maps walk to completion.
 */
function parseBody(
  reader: BinaryReader,
  objClass: number,
  format: SimpleFormat
): number | null {
  switch (objClass) {
    // Empty bodies (cursor stays put):
    case ObjClass.GRAIL:
      // u32 grail radius — only 4 bytes, no owner.
      reader.skip(4);
      return null;

    // No body at all (just a marker on the map).
    case ObjClass.MAGIC_PLAINS1:
    case ObjClass.CURSED_GROUND1:
      return null;

    // Arena (+1 attack/defense visit)
    case 4:
    // Boat (no body — boats on map are decorations; player-owned
    // ones are tracked elsewhere in the engine).
    case ObjClass.BOAT:
    // Keymaster's Tent (key color is in template subId)
    case ObjClass.KEYMASTER:
    // Creature banks: derelict ship, dragon utopia, crypt — engine
    // generates rewards from template subId; no map-file body.
    case ObjClass.DERELICT_SHIP:
    case ObjClass.DRAGON_UTOPIA:
    case ObjClass.CRYPT:
    // Border guard (key color in template subId, no body)
    case ObjClass.BORDERGUARD:
    case ObjClass.BORDER_GATE:
    case ObjClass.HOLE:
    case ObjClass.SCHOOL_OF_MAGIC:
    case ObjClass.MAGIC_SPRING:
    case ObjClass.MAGIC_WELL:
    case ObjClass.FAERIE_RING:
    case ObjClass.FOUNTAIN_OF_FORTUNE:
    case ObjClass.FOUNTAIN_OF_YOUTH:
    case ObjClass.GARDEN_OF_REVELATION:
    case ObjClass.IDOL_OF_FORTUNE:
    case ObjClass.LEAN_TO:
    case ObjClass.LIBRARY_OF_ENLIGHTENMENT:
    case ObjClass.MERCENARY_CAMP:
    case ObjClass.MERMAID:
    case ObjClass.MYSTICAL_GARDEN:
    case ObjClass.OASIS:
    case ObjClass.OBELISK:
    case ObjClass.REDWOOD_OBSERVATORY:
    case ObjClass.PILLAR_OF_FIRE:
    case ObjClass.STAR_AXIS:
    case ObjClass.RALLY_FLAG:
    case ObjClass.SANCTUARY:
    case ObjClass.SCHOOL_OF_WAR:
    case ObjClass.STABLES:
    case ObjClass.SWAN_POND:
    case ObjClass.TEMPLE:
    case ObjClass.DEN_OF_THIEVES:
    case ObjClass.TRADING_POST:
    case ObjClass.LEARNING_STONE:
    case ObjClass.TREE_OF_KNOWLEDGE:
    case ObjClass.UNIVERSITY:
    case ObjClass.WAGON:
    case ObjClass.WAR_MACHINE_FACTORY:
    case ObjClass.WARRIORS_TOMB:
    case ObjClass.WATER_WHEEL:
    case ObjClass.WATERING_HOLE:
    case ObjClass.WHIRLPOOL:
    case ObjClass.WINDMILL:
    case ObjClass.HUT_OF_MAGI:
    case ObjClass.EYE_OF_MAGI:
    case ObjClass.CARTOGRAPHER:
    case ObjClass.MARLETTO_TOWER:
    case ObjClass.PYRAMID:
    case ObjClass.SIRENS:
    case ObjClass.TAVERN:
    case ObjClass.TREASURE_CHEST:
    case ObjClass.CAMPFIRE:
    case ObjClass.FLOTSAM:
    case ObjClass.SEA_CHEST:
    case ObjClass.SHIPWRECK_SURVIVOR:
    case ObjClass.CORPSE:
    case ObjClass.LIGHTHOUSE:
    case ObjClass.HILL_FORT:
    case ObjClass.REFUGEE_CAMP:
    case ObjClass.MONOLITH_ONE_WAY_ENTRANCE:
    case ObjClass.MONOLITH_ONE_WAY_EXIT:
    case ObjClass.MONOLITH_TWO_WAY:
    case ObjClass.SUBTERRANEAN_GATE:
      return null;

    // Decorative adventure-map objects (lakes, mountains, rocks,
    // trees, ridges, swamps, plains, etc.). Sprite names confirm
    // the AVL* prefix; verified across the corpus that these have
    // no body — cursor lands directly on the next instance header.
    case 116:
    case 117:
    case 118:
    case 119:
    case 120:
    case 121:
    case 122:
    case 123:
    case 125:
    case 126:
    case 127:
    case 128:
    case 129:
    case 130:
    case 131:
    case 132:
    case 133:
    case 134:
    case 135:
    case 136:
    case 137:
    case 138:
    case 139:
    case 140:
    case 141:
    case 142:
    case 143:
    case 144:
    case 145:
    case 146:
    case 147:
    case 148:
    case 149:
    case 150:
    case 151:
    case 152:
    case 153:
    case 154:
    case 155:
    case 156:
    case 157:
    case 158:
    case 159:
    case 160:
    case 161:
    case 165:
    case 166:
    case 167:
    case 168:
    case 169:
    case 170:
    case 171:
    case 172:
    case 173:
    case 174:
    case 175:
    case 176:
    case 177:
    case 178:
    case 179:
    case 180:
    case 181:
    case 182:
    case 183:
    case 184:
    case 185:
    case 186:
    case 187:
    case 188:
    case 189:
    case 190:
    case 191:
    case 192:
    case 193:
    case 194:
    case 195:
    case 196:
    case 197:
    case 198:
    case 199:
    case 200:
    case 201:
    case 202:
    case 203:
    case 204:
    case 205:
    case 206:
    case 207:
    case 208:
    case 209:
    case 210:
    case 211:
      return null;

    // Owner-only bodies (4 bytes: u32 owner color)
    case ObjClass.SHIPYARD:
    case ObjClass.GARRISON:
    case ObjClass.MINE:
    case ObjClass.CREATURE_GENERATOR1:
    case ObjClass.CREATURE_GENERATOR4:
      return reader.u32le();

    // Sign / Ocean Bottle: optional message
    case ObjClass.SIGN:
    case ObjClass.OCEAN_BOTTLE:
      reader.string(); // message
      reader.skip(4); // padding
      return null;

    // Resource: u8 hasMessage; if set, string + 4 bytes guard data
    case ObjClass.RESOURCE: {
      readMessageAndGuards(reader);
      const amount = reader.u32le();
      void amount;
      reader.skip(4); // padding
      return null;
    }
    case ObjClass.RANDOM_RESOURCE: {
      readMessageAndGuards(reader);
      reader.skip(4); // amount
      reader.skip(4); // padding
      return null;
    }

    // Artifact / Spell Scroll
    case ObjClass.ARTIFACT:
    case ObjClass.RANDOM_ART:
    case ObjClass.RANDOM_TREASURE_ART:
    case ObjClass.RANDOM_MINOR_ART:
    case ObjClass.RANDOM_MAJOR_ART:
    case ObjClass.RANDOM_RELIC_ART: {
      readMessageAndGuards(reader);
      return null;
    }
    case ObjClass.SPELL_SCROLL: {
      readMessageAndGuards(reader);
      reader.skip(4); // spell id
      return null;
    }

    // Monster (regular + random variants share structure)
    case ObjClass.MONSTER:
    case ObjClass.RANDOM_MONSTER:
    case ObjClass.RANDOM_MONSTER_L1:
    case ObjClass.RANDOM_MONSTER_L2:
    case ObjClass.RANDOM_MONSTER_L3:
    case ObjClass.RANDOM_MONSTER_L4:
    case ObjClass.RANDOM_MONSTER_L5:
    case ObjClass.RANDOM_MONSTER_L6:
    case ObjClass.RANDOM_MONSTER_L7: {
      if (format !== "RoE") reader.skip(4); // identifier
      reader.skip(2); // count (u16)
      reader.skip(1); // character (aggression)
      const hasMsg = reader.bool();
      if (hasMsg) {
        reader.string(); // message
        reader.skip(7 * 4); // 7 resource amounts
        reader.skip(format === "RoE" ? 1 : 2); // artifact id
      }
      reader.skip(1); // never flees
      reader.skip(1); // does not grow
      reader.skip(2); // padding
      return null;
    }

    // Witch hut: skill bitmask (4 bytes for SoD/AB; RoE has no skill mask)
    case ObjClass.WITCH_HUT: {
      if (format !== "RoE") reader.skip(4);
      return null;
    }

    // Scholar: bonus type + value
    case ObjClass.SCHOLAR: {
      reader.skip(2);
      reader.skip(6); // padding
      return null;
    }

    // Shrine of magic — spell id (u32) for SoD/AB; RoE uses u8 maybe.
    case ObjClass.SHRINE_OF_MAGIC_INCANTATION:
    case ObjClass.SHRINE_OF_MAGIC_GESTURE:
    case ObjClass.SHRINE_OF_MAGIC_THOUGHT: {
      reader.skip(4);
      return null;
    }

    // Town / Random Town
    case ObjClass.TOWN:
    case ObjClass.RANDOM_TOWN: {
      return parseTownBody(reader, format);
    }

    // Hero / Random Hero / Prison (uses hero structure)
    case ObjClass.HERO:
    case ObjClass.RANDOM_HERO:
    case ObjClass.PRISON: {
      return parseHeroBody(reader, format);
    }

    default:
      throw new Error(
        `unsupported object class ${objClass} (need body parser)`
      );
  }
}

/**
 * Town body — moderately complex. Walks past garrison, custom
 * buildings, spell lists, town events, alignment.
 */
function parseTownBody(
  reader: BinaryReader,
  format: SimpleFormat
): number {
  if (format !== "RoE") reader.skip(4); // questIdentifier
  const owner = reader.u8();
  const hasName = reader.bool();
  if (hasName) reader.string();
  const hasGarrison = reader.bool();
  if (hasGarrison) {
    // 7 stacks of (creature, count). Width is u16/u16 for AB+, u8/u16 for RoE.
    const idBytes = format === "RoE" ? 1 : 2;
    reader.skip(7 * (idBytes + 2));
  }
  reader.skip(1); // formation
  const hasCustomBuildings = reader.bool();
  if (hasCustomBuildings) {
    reader.skip(12); // built buildings (96 bits = 12 bytes)
    reader.skip(12); // forbidden buildings
  } else {
    reader.skip(1); // hasFort
  }
  if (format !== "RoE") reader.skip(9); // obligatory spells
  reader.skip(9); // possible spells
  const eventCount = reader.u32le();
  for (let i = 0; i < eventCount; i++) {
    parseTownEvent(reader, format);
  }
  if (format === "SoD") reader.skip(1); // alignment
  reader.skip(3); // padding
  return owner;
}

function parseTownEvent(reader: BinaryReader, format: SimpleFormat): void {
  reader.string(); // name
  reader.string(); // message
  reader.skip(7 * 4); // resources granted (7 u32)
  reader.skip(1); // players (bitmask)
  if (format !== "RoE") reader.skip(1); // human/computer affected
  reader.skip(1); // computer affected (always present?)
  reader.skip(2); // first occurrence (u16 day)
  reader.skip(1); // subsequent occurrences (every N days)
  reader.skip(17); // padding (per VCMI: 17 bytes here)
  reader.skip(6); // new buildings bitmask (48 bits = 6 bytes)
  reader.skip(7 * 4); // creature counts at each dwelling level (7 levels * u32)
  reader.skip(4); // padding
}

/**
 * Hero placement body. Similar in spirit to predefined heroes but
 * with owner + position data and a few different fields.
 */
function parseHeroBody(reader: BinaryReader, format: SimpleFormat): number {
  if (format !== "RoE") reader.skip(4); // questIdentifier
  const owner = reader.u8();
  reader.u8(); // hero type (subId)

  const hasName = reader.bool();
  if (hasName) reader.string();

  if (format === "SoD") {
    const hasExp = reader.bool();
    if (hasExp) reader.skip(4);
  } else {
    // AB/RoE: experience field is unconditional u32
    reader.skip(4);
  }

  const hasFace = reader.bool();
  if (hasFace) reader.u8(); // portrait

  const hasSecSkills = reader.bool();
  if (hasSecSkills) {
    const n = reader.u32le();
    reader.skip(n * 2); // u8 skill + u8 level
  }

  const hasGarrison = reader.bool();
  if (hasGarrison) {
    const idBytes = format === "RoE" ? 1 : 2;
    reader.skip(7 * (idBytes + 2));
  }
  reader.skip(1); // formation

  const hasCustomArt = reader.bool();
  if (hasCustomArt) {
    const idBytes = format === "RoE" ? 1 : 2;
    const fixedSlots = format === "SoD" ? 19 : 18;
    reader.skip(fixedSlots * idBytes);
    const bp = reader.u16le();
    reader.skip(bp * idBytes);
  }

  reader.skip(1); // patrol radius

  if (format !== "RoE") {
    const hasBio = reader.bool();
    if (hasBio) reader.string();
    reader.skip(1); // sex
  }

  if (format === "SoD") {
    const hasSpells = reader.bool();
    if (hasSpells) reader.skip(9);
    const hasPrim = reader.bool();
    if (hasPrim) reader.skip(4);
  }

  reader.skip(16); // reserved padding
  return owner;
}

function readMessageAndGuards(reader: BinaryReader): void {
  const hasMsg = reader.bool();
  if (hasMsg) {
    reader.string(); // message
    const hasGuards = reader.bool();
    if (hasGuards) {
      // 7 stacks of u16 creature id + u16 count
      reader.skip(7 * 4);
    }
    reader.skip(4); // padding
  }
}

void EofError;
