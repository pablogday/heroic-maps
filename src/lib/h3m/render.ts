import type { Terrain, Tile } from "./terrain";
import type { MapObjectInstance } from "./objects";
import { categoryFor } from "./objectClasses";

/**
 * Terrain → minimap image. Pure: outputs raw RGBA pixels in a
 * Uint8ClampedArray, leaves PNG encoding to the caller (sharp on
 * Node, canvas.toBlob in the browser).
 *
 * Tile rendering for v0.9: solid color per terrain type. Variants,
 * rivers, roads, and the HoMM3 minimap's signature dithering are
 * v1.0 polish — bias toward a solid retro look first, then refine.
 */

/**
 * Palette per terrain id. Index 0..9 are the vanilla HoMM3 terrains;
 * 10..11 are the HotA additions (highlands + wasteland — best-known
 * order; verify when we run a real HotA sample through the renderer).
 *
 * Colors loosely match the in-game minimap; tweaked for legibility
 * at small sizes. Each entry is [r, g, b].
 */
export const TERRAIN_COLOR: Array<[number, number, number]> = [
  [0x52, 0x39, 0x18], // 0 dirt — chestnut
  [0xc8, 0xa0, 0x60], // 1 sand — light tan
  [0x46, 0x76, 0x2a], // 2 grass — leaf green
  [0xc8, 0xd0, 0xd8], // 3 snow — bone white
  [0x32, 0x4a, 0x32], // 4 swamp — moss
  [0x80, 0x70, 0x40], // 5 rough — olive
  [0x6a, 0x44, 0x28], // 6 subterranean — burnt orange
  [0x9a, 0x2a, 0x18], // 7 lava — fire
  [0x2a, 0x44, 0x9a], // 8 water — deep blue
  [0x20, 0x1c, 0x20], // 9 rock — near-black
  [0x60, 0x80, 0x40], // 10 highlands (HotA)
  [0xb8, 0xa8, 0x88], // 11 wasteland (HotA)
];

/** Color for unknown terrain ids — bright magenta to flag misalignment. */
const UNKNOWN_COLOR: [number, number, number] = [0xff, 0x00, 0xff];

const ROAD_COLOR: [number, number, number] = [0xb8, 0x90, 0x50];
const RIVER_COLOR: [number, number, number] = [0x4a, 0x70, 0xc8];

export interface MinimapImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  pixels: Uint8ClampedArray;
}

export interface RenderOptions {
  /** Pixels per tile. Default 4 — gives 144×4 = 576px on XL. */
  tileSize?: number;
  /** Render the underground level instead of surface. */
  underground?: boolean;
  /**
   * Stack surface and underground side by side (with a thin divider).
   * Ignored when the map has no underground.
   */
  bothLevels?: boolean;
  /** Object instances to render as markers on top of the terrain. */
  objects?: MapObjectInstance[];
}

/** Per-category marker color (RGB). */
const MARKER_COLOR: Partial<
  Record<ReturnType<typeof categoryFor>, [number, number, number]>
> = {
  towns: [0xff, 0xd0, 0x40], // gold
  heroes: [0xff, 0xff, 0xff], // white
  monsters: [0xff, 0x40, 0x40], // bright red
  mines: [0xff, 0x90, 0x20], // orange
  dwellings: [0xa0, 0x60, 0xc8], // purple
  resources: [0x40, 0xc8, 0xff], // cyan
  artifacts: [0xc0, 0x80, 0xff], // violet
  treasures: [0xff, 0xc0, 0x60], // amber
  questPoints: [0xff, 0x40, 0xc0], // magenta
};

/** Per-category marker size in tiles. */
const MARKER_SIZE: Partial<
  Record<ReturnType<typeof categoryFor>, number>
> = {
  towns: 4,
  heroes: 3,
  monsters: 2,
  mines: 3,
  dwellings: 3,
  resources: 2,
  artifacts: 2,
  treasures: 2,
  questPoints: 3,
};

export function renderMinimap(
  terrain: Terrain,
  opts: RenderOptions = {}
): MinimapImage {
  const tileSize = opts.tileSize ?? 4;
  const showBoth =
    opts.bothLevels === true && terrain.underground !== null;

  const layerW = terrain.width * tileSize;
  const layerH = terrain.height * tileSize;
  const dividerW = showBoth ? 2 : 0;
  const width = showBoth ? layerW * 2 + dividerW : layerW;
  const height = layerH;

  const pixels = new Uint8ClampedArray(width * height * 4);
  fill(pixels, width, 0, 0, width, height, [0x10, 0x0c, 0x10]); // bg

  const surfaceObjects = (opts.objects ?? []).filter((o) => o.z === 0);
  const undergroundObjects = (opts.objects ?? []).filter((o) => o.z === 1);

  drawLayer(
    pixels,
    width,
    showBoth || !opts.underground ? terrain.surface : terrain.underground!,
    terrain.width,
    terrain.height,
    0,
    0,
    tileSize
  );
  if (opts.objects && opts.objects.length > 0) {
    drawObjects(
      pixels,
      width,
      showBoth || !opts.underground ? surfaceObjects : undergroundObjects,
      0,
      0,
      tileSize
    );
  }
  if (showBoth) {
    drawLayer(
      pixels,
      width,
      terrain.underground!,
      terrain.width,
      terrain.height,
      layerW + dividerW,
      0,
      tileSize
    );
    if (opts.objects && opts.objects.length > 0) {
      drawObjects(
        pixels,
        width,
        undergroundObjects,
        layerW + dividerW,
        0,
        tileSize
      );
    }
  }

  return { width, height, pixels };
}

function drawObjects(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  objects: MapObjectInstance[],
  offsetX: number,
  offsetY: number,
  tileSize: number
) {
  // Render in priority order so towns paint on top of everything.
  const order: ReturnType<typeof categoryFor>[] = [
    "decorations",
    "oneShotBoosts",
    "treasures",
    "resources",
    "artifacts",
    "monsters",
    "questPoints",
    "dwellings",
    "mines",
    "heroes",
    "towns",
  ];
  for (const cat of order) {
    const color = MARKER_COLOR[cat];
    const size = MARKER_SIZE[cat];
    if (!color || !size) continue;
    for (const obj of objects) {
      if (categoryFor(obj.objClass) !== cat) continue;
      // Center the marker on the object's tile.
      const centerX = offsetX + obj.x * tileSize + Math.floor(tileSize / 2);
      const centerY = offsetY + obj.y * tileSize + Math.floor(tileSize / 2);
      const half = Math.floor(size / 2);
      fillSafe(
        pixels,
        imageWidth,
        Math.max(0, centerX - half),
        Math.max(0, centerY - half),
        size,
        size,
        color
      );
      // Outline for the biggest markers (towns) so they stay legible.
      if (size >= 4) {
        outlineSafe(
          pixels,
          imageWidth,
          Math.max(0, centerX - half - 1),
          Math.max(0, centerY - half - 1),
          size + 2,
          size + 2,
          [0x10, 0x0c, 0x10]
        );
      }
    }
  }
}

function fillSafe(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number]
) {
  const imageHeight = pixels.length / 4 / imageWidth;
  for (let dy = 0; dy < h; dy++) {
    if (y + dy >= imageHeight) break;
    for (let dx = 0; dx < w; dx++) {
      if (x + dx >= imageWidth) break;
      const i = ((y + dy) * imageWidth + (x + dx)) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = 0xff;
    }
  }
}

function outlineSafe(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number]
) {
  // Top + bottom rows
  fillSafe(pixels, imageWidth, x, y, w, 1, color);
  fillSafe(pixels, imageWidth, x, y + h - 1, w, 1, color);
  // Left + right columns
  fillSafe(pixels, imageWidth, x, y, 1, h, color);
  fillSafe(pixels, imageWidth, x + w - 1, y, 1, h, color);
}

function drawLayer(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  layer: Tile[],
  cols: number,
  rows: number,
  offsetX: number,
  offsetY: number,
  tileSize: number
) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = layer[y * cols + x];
      const baseColor =
        TERRAIN_COLOR[tile.terrain] ?? UNKNOWN_COLOR;
      // Slight per-tile dither based on terrainView so adjacent tiles
      // of the same terrain don't look like a flat blob.
      const dither = ((tile.terrainView * 13) % 17) - 8;
      const color: [number, number, number] = [
        clamp(baseColor[0] + dither),
        clamp(baseColor[1] + dither),
        clamp(baseColor[2] + dither),
      ];
      fill(
        pixels,
        imageWidth,
        offsetX + x * tileSize,
        offsetY + y * tileSize,
        tileSize,
        tileSize,
        color
      );
      // Roads + rivers as a single bright pixel in the tile center.
      // Cheap signal at small tile sizes; we can do anti-aliased
      // line rendering later if it looks worth it.
      if (tile.road > 0 && tileSize >= 3) {
        plot(
          pixels,
          imageWidth,
          offsetX + x * tileSize + (tileSize >> 1),
          offsetY + y * tileSize + (tileSize >> 1),
          ROAD_COLOR
        );
      }
      if (tile.river > 0 && tileSize >= 3) {
        plot(
          pixels,
          imageWidth,
          offsetX + x * tileSize + (tileSize >> 1) - 1,
          offsetY + y * tileSize + (tileSize >> 1),
          RIVER_COLOR
        );
      }
    }
  }
}

function fill(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number]
) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const i = ((y + dy) * imageWidth + (x + dx)) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = 0xff;
    }
  }
}

function plot(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  color: [number, number, number]
) {
  const i = (y * imageWidth + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = 0xff;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
