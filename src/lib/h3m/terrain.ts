import { BinaryReader } from "./reader";

/**
 * Terrain layer: a width×height grid of 7-byte tiles, repeated for the
 * underground level when `hasUnderground` is true. This is what a
 * minimap renderer consumes.
 *
 * Tile bytes (per VCMI MapFormatH3M and community references):
 *   [0] terrainType   — 0..9 (dirt, sand, grass, snow, swamp, rough,
 *                       subterranean, lava, water, rock)
 *   [1] terrainView   — image variant within the terrain type
 *   [2] riverType     — 0..4 (none, clear, icy, muddy, lava)
 *   [3] riverView     — variant
 *   [4] roadType      — 0..3 (none, dirt, gravel, cobblestone)
 *   [5] roadView      — variant
 *   [6] flags         — bitfield: rotation + tile flags
 *
 * HotA may extend the terrain enum (Cove adds Highlands/Wasteland);
 * the byte layout is unchanged so this parser works across formats —
 * higher terrain type ids just need palette entries when rendering.
 */

export const TERRAIN_NAMES = [
  "dirt",
  "sand",
  "grass",
  "snow",
  "swamp",
  "rough",
  "subterranean",
  "lava",
  "water",
  "rock",
  // HotA additions (best-known order; verify when rendering):
  "highlands",
  "wasteland",
] as const;

export interface Tile {
  terrain: number;
  terrainView: number;
  river: number;
  riverView: number;
  road: number;
  roadView: number;
  flags: number;
}

export interface Terrain {
  width: number;
  height: number;
  hasUnderground: boolean;
  /** Indexed `[y * width + x]`. */
  surface: Tile[];
  underground: Tile[] | null;
}

export function parseTerrain(
  reader: BinaryReader,
  width: number,
  height: number,
  hasUnderground: boolean
): Terrain {
  const surface = parseLayer(reader, width, height);
  const underground = hasUnderground
    ? parseLayer(reader, width, height)
    : null;
  return { width, height, hasUnderground, surface, underground };
}

function parseLayer(
  reader: BinaryReader,
  width: number,
  height: number
): Tile[] {
  const tiles: Tile[] = new Array(width * height);
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = {
      terrain: reader.u8(),
      terrainView: reader.u8(),
      river: reader.u8(),
      riverView: reader.u8(),
      road: reader.u8(),
      roadView: reader.u8(),
      flags: reader.u8(),
    };
  }
  return tiles;
}

/**
 * Quick sanity check: a real terrain layer has terrain types in
 * 0..N (small range). Returns the fraction of tiles whose terrain
 * id falls outside the known range — close to 0 means we landed
 * correctly.
 */
export function terrainPlausibility(layer: Tile[]): number {
  let bad = 0;
  for (const t of layer) {
    if (t.terrain >= TERRAIN_NAMES.length) bad++;
  }
  return bad / layer.length;
}
