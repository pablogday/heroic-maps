/**
 * HoMM3 object class IDs. There are ~100+; this enum names the ones
 * we know how to parse the body for. Cross-reference table for
 * everything else lives in `OBJECT_CLASS_NAMES` so unknown classes
 * still surface a meaningful "not yet supported: <name>".
 */

export const enum ObjClass {
  ARTIFACT = 5,
  PANDORAS_BOX = 6,
  BLACK_MARKET = 7,
  BOAT = 8,
  BORDERGUARD = 9,
  KEYMASTER = 10,
  BORDER_GATE = 11,
  CAMPFIRE = 12,
  CARTOGRAPHER = 13,
  SWAN_POND = 14,
  COVER_OF_DARKNESS = 15,
  CREATURE_BANK = 16,
  CREATURE_GENERATOR1 = 17,
  CREATURE_GENERATOR4 = 20,
  CURSED_GROUND1 = 21,
  CORPSE = 22,
  MARLETTO_TOWER = 23,
  DERELICT_SHIP = 24,
  DRAGON_UTOPIA = 25,
  EVENT = 26,
  EYE_OF_MAGI = 27,
  FAERIE_RING = 28,
  FLOTSAM = 29,
  FOUNTAIN_OF_FORTUNE = 30,
  FOUNTAIN_OF_YOUTH = 31,
  GARDEN_OF_REVELATION = 32,
  GARRISON = 33,
  HERO = 34,
  HILL_FORT = 35,
  GRAIL = 36,
  HUT_OF_MAGI = 37,
  IDOL_OF_FORTUNE = 38,
  LEAN_TO = 39,
  LIBRARY_OF_ENLIGHTENMENT = 41,
  LIGHTHOUSE = 42,
  MONOLITH_ONE_WAY_ENTRANCE = 43,
  MONOLITH_ONE_WAY_EXIT = 44,
  MONOLITH_TWO_WAY = 45,
  MAGIC_PLAINS1 = 46,
  SCHOOL_OF_MAGIC = 47,
  MAGIC_SPRING = 48,
  MAGIC_WELL = 49,
  MERCENARY_CAMP = 51,
  MERMAID = 52,
  MINE = 53,
  MONSTER = 54,
  MYSTICAL_GARDEN = 55,
  OASIS = 56,
  OBELISK = 57,
  REDWOOD_OBSERVATORY = 58,
  OCEAN_BOTTLE = 59,
  PILLAR_OF_FIRE = 60,
  STAR_AXIS = 61,
  PRISON = 62,
  PYRAMID = 63,
  RALLY_FLAG = 64,
  RANDOM_ART = 65,
  RANDOM_TREASURE_ART = 66,
  RANDOM_MINOR_ART = 67,
  RANDOM_MAJOR_ART = 68,
  RANDOM_RELIC_ART = 69,
  RANDOM_HERO = 70,
  RANDOM_MONSTER = 71,
  RANDOM_MONSTER_L1 = 72,
  RANDOM_MONSTER_L2 = 73,
  RANDOM_MONSTER_L3 = 74,
  RANDOM_MONSTER_L4 = 75,
  RANDOM_RESOURCE = 76,
  RANDOM_TOWN = 77,
  REFUGEE_CAMP = 78,
  RESOURCE = 79,
  SANCTUARY = 80,
  SCHOLAR = 81,
  SEA_CHEST = 82,
  SEERS_HUT = 83,
  CRYPT = 84,
  SHIPWRECK = 85,
  SHIPWRECK_SURVIVOR = 86,
  SHIPYARD = 87,
  SHRINE_OF_MAGIC_INCANTATION = 88,
  SHRINE_OF_MAGIC_GESTURE = 89,
  SHRINE_OF_MAGIC_THOUGHT = 90,
  SIGN = 91,
  SIRENS = 92,
  SPELL_SCROLL = 93,
  STABLES = 94,
  TAVERN = 95,
  TEMPLE = 96,
  DEN_OF_THIEVES = 97,
  TOWN = 98,
  TRADING_POST = 99,
  LEARNING_STONE = 100,
  TREASURE_CHEST = 101,
  TREE_OF_KNOWLEDGE = 102,
  SUBTERRANEAN_GATE = 103,
  UNIVERSITY = 104,
  WAGON = 105,
  WAR_MACHINE_FACTORY = 106,
  SCHOOL_OF_WAR = 107,
  WARRIORS_TOMB = 108,
  WATER_WHEEL = 109,
  WATERING_HOLE = 110,
  WHIRLPOOL = 111,
  WINDMILL = 112,
  WITCH_HUT = 113,
  HOLE = 124,
  RANDOM_MONSTER_L5 = 162,
  RANDOM_MONSTER_L6 = 163,
  RANDOM_MONSTER_L7 = 164,
  BORDERGUARD_HOTA = 212,
  FREELANCERS_GUILD = 213,
  TRADING_POST_HOTA = 221,
}

export const OBJECT_CLASS_NAMES: Record<number, string> = {
  5: "Artifact",
  6: "Pandora's Box",
  7: "Black Market",
  8: "Boat",
  9: "Borderguard",
  10: "Keymaster's Tent",
  11: "Border Gate",
  12: "Campfire",
  13: "Cartographer",
  14: "Swan Pond",
  15: "Cover of Darkness",
  16: "Creature Bank",
  17: "Creature Generator 1",
  20: "Creature Generator 4",
  22: "Corpse",
  26: "Event",
  33: "Garrison",
  34: "Hero",
  36: "Grail",
  53: "Mine",
  54: "Monster",
  57: "Obelisk",
  62: "Prison",
  65: "Random Artifact",
  66: "Random Treasure Artifact",
  67: "Random Minor Artifact",
  68: "Random Major Artifact",
  69: "Random Relic Artifact",
  70: "Random Hero",
  71: "Random Monster",
  72: "Random Monster L1",
  73: "Random Monster L2",
  74: "Random Monster L3",
  75: "Random Monster L4",
  76: "Random Resource",
  77: "Random Town",
  78: "Refugee Camp",
  79: "Resource",
  81: "Scholar",
  83: "Seer's Hut",
  87: "Shipyard",
  88: "Shrine of Magic (Lvl 1)",
  89: "Shrine of Magic (Lvl 2)",
  90: "Shrine of Magic (Lvl 3)",
  91: "Sign",
  93: "Spell Scroll",
  98: "Town",
  103: "Subterranean Gate",
  113: "Witch Hut",
  124: "Hole",
  162: "Random Monster L5",
  163: "Random Monster L6",
  164: "Random Monster L7",
  216: "Random Dwelling (Faction Random)",
  217: "Random Dwelling (Level Random)",
  218: "Random Dwelling (Faction & Level Random)",
};

export function objectClassName(id: number): string {
  return OBJECT_CLASS_NAMES[id] ?? `Object#${id}`;
}

/**
 * Coarse user-facing categories. Used for the "Map Contents" UI card
 * — small set of labels users actually care about.
 */
export type ObjectCategory =
  | "towns"
  | "heroes"
  | "monsters"
  | "mines"
  | "resources"
  | "artifacts"
  | "dwellings"
  | "questPoints"
  | "oneShotBoosts"
  | "treasures"
  | "decorations"
  | "other";

export function categoryFor(objClass: number): ObjectCategory {
  switch (objClass) {
    case 77:
    case 98:
      return "towns";
    case 34:
    case 70:
    case 62: // PRISON
    case 214: // HERO_PLACEHOLDER
      return "heroes";
    case 54:
    case 71:
    case 72:
    case 73:
    case 74:
    case 75:
    case 162:
    case 163:
    case 164:
      return "monsters";
    case 53:
      return "mines";
    case 76:
    case 79:
      return "resources";
    case 5: // ARTIFACT
    case 65:
    case 66:
    case 67:
    case 68:
    case 69:
    case 93: // SPELL_SCROLL
      return "artifacts";
    case 17:
    case 18:
    case 19:
    case 20: // CREATURE_GENERATORS
    case 78: // REFUGEE_CAMP
    case 216:
    case 217:
    case 218: // RANDOM_DWELLINGS
      return "dwellings";
    case 6: // PANDORA
    case 26: // EVENT
    case 36: // GRAIL
    case 83: // SEERS_HUT
    case 215: // QUEST_GUARD
      return "questPoints";
    case 4: // ARENA
    case 14: // SWAN_POND
    case 27: // EYE_OF_MAGI
    case 28: // FAERIE_RING
    case 30: // FOUNTAIN_OF_FORTUNE
    case 31: // FOUNTAIN_OF_YOUTH
    case 32: // GARDEN_OF_REVELATION
    case 38: // IDOL_OF_FORTUNE
    case 39: // LEAN_TO
    case 41: // LIBRARY_OF_ENLIGHTENMENT
    case 47: // SCHOOL_OF_MAGIC
    case 48: // MAGIC_SPRING
    case 49: // MAGIC_WELL
    case 51: // MERCENARY_CAMP
    case 52: // MERMAID
    case 55: // MYSTICAL_GARDEN
    case 56: // OASIS
    case 57: // OBELISK
    case 58: // REDWOOD_OBSERVATORY
    case 60: // PILLAR_OF_FIRE
    case 61: // STAR_AXIS
    case 64: // RALLY_FLAG
    case 80: // SANCTUARY
    case 81: // SCHOLAR
    case 88: // SHRINE_OF_MAGIC_INCANTATION
    case 89: // SHRINE_OF_MAGIC_GESTURE
    case 90: // SHRINE_OF_MAGIC_THOUGHT
    case 94: // STABLES
    case 96: // TEMPLE
    case 100: // LEARNING_STONE
    case 102: // TREE_OF_KNOWLEDGE
    case 107: // SCHOOL_OF_WAR
    case 109: // WATER_WHEEL
    case 112: // WINDMILL
    case 113: // WITCH_HUT
      return "oneShotBoosts";
    case 12: // CAMPFIRE
    case 22: // CORPSE
    case 24: // DERELICT_SHIP
    case 25: // DRAGON_UTOPIA
    case 29: // FLOTSAM
    case 82: // SEA_CHEST
    case 84: // CRYPT
    case 85: // SHIPWRECK
    case 86: // SHIPWRECK_SURVIVOR
    case 101: // TREASURE_CHEST
    case 105: // WAGON
    case 108: // WARRIORS_TOMB
    case 16: // CREATURE_BANK
    case 63: // PYRAMID
      return "treasures";
    default:
      // 116-211 are AVL* decorations (lakes/mountains/rocks/trees)
      if (objClass >= 116 && objClass <= 211) return "decorations";
      return "other";
  }
}

export interface ObjectStats {
  towns: number;
  heroes: number;
  monsters: number;
  mines: number;
  resources: number;
  artifacts: number;
  dwellings: number;
  questPoints: number;
  oneShotBoosts: number;
  treasures: number;
  decorations: number;
  other: number;
  totalObjects: number;
}

export function emptyStats(): ObjectStats {
  return {
    towns: 0,
    heroes: 0,
    monsters: 0,
    mines: 0,
    resources: 0,
    artifacts: 0,
    dwellings: 0,
    questPoints: 0,
    oneShotBoosts: 0,
    treasures: 0,
    decorations: 0,
    other: 0,
    totalObjects: 0,
  };
}

export function summarizeObjects(
  instances: Array<{ objClass: number }>
): ObjectStats {
  const stats = emptyStats();
  for (const inst of instances) {
    const cat = categoryFor(inst.objClass);
    stats[cat]++;
    stats.totalObjects++;
  }
  return stats;
}
