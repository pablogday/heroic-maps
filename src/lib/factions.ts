/**
 * The 9 HoMM3 towns. `keywords` are used by the description-text
 * inference backfill — they include the faction name plus signature
 * units / heroes that make a faction unmistakable.
 */
export const FACTIONS = [
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
export type Faction = (typeof FACTIONS)[number];

export const FACTION_LABEL: Record<Faction, string> = {
  castle: "Castle",
  rampart: "Rampart",
  tower: "Tower",
  inferno: "Inferno",
  necropolis: "Necropolis",
  dungeon: "Dungeon",
  stronghold: "Stronghold",
  fortress: "Fortress",
  conflux: "Conflux",
};

/** Accent color used in the crest emblem. */
export const FACTION_COLOR: Record<Faction, string> = {
  castle: "#d8d8e0",
  rampart: "#3f8a4f",
  tower: "#7ec0d6",
  inferno: "#c44b1a",
  necropolis: "#7a5a8e",
  dungeon: "#8a2222",
  stronghold: "#c08338",
  fortress: "#7d8b54",
  conflux: "#e0b656",
};

/** Lowercased keyword hints for description-based inference. */
export const FACTION_KEYWORDS: Record<Faction, string[]> = {
  castle: ["castle", "knight", "cavalier", "griffin", "monk", "angel", "swordsman"],
  rampart: ["rampart", "elf", "dendroid", "unicorn", "dwarf", "centaur", "pegasus"],
  tower: ["tower", "wizard", "mage", "gremlin", "naga", "titan", "genie", "golem"],
  inferno: ["inferno", "demon", "imp", "devil", "efreet", "magog", "pit fiend", "pit lord"],
  necropolis: [
    "necropolis",
    "necromancer",
    "lich",
    "vampire",
    "skeleton",
    "zombie",
    "wight",
    "death knight",
  ],
  dungeon: [
    "dungeon",
    "warlock",
    "minotaur",
    "manticore",
    "beholder",
    "medusa",
    "black dragon",
    "troglodyte",
  ],
  stronghold: [
    "stronghold",
    "barbarian",
    "orc",
    "ogre",
    "cyclops",
    "behemoth",
    "goblin",
    "wolf rider",
  ],
  fortress: [
    "fortress",
    "beastmaster",
    "witch",
    "gnoll",
    "lizardman",
    "wyvern",
    "hydra",
    "basilisk",
  ],
  conflux: [
    "conflux",
    "elementalist",
    "planeswalker",
    "phoenix",
    "magic elemental",
    "fire elemental",
    "water elemental",
    "earth elemental",
    "air elemental",
  ],
};

/** Heuristic: scan a blob of text and return the factions that appear. */
export function inferFactionsFromText(text: string | null | undefined): Faction[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: Faction[] = [];
  for (const f of FACTIONS) {
    const kws = FACTION_KEYWORDS[f];
    if (kws.some((kw) => lower.includes(kw))) hits.push(f);
  }
  return hits;
}
