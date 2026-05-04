import Image from "next/image";
import { FACTION_LABEL, type Faction } from "@/lib/factions";

/**
 * Town crest — the actual in-game town banner sprite from Heroes 3,
 * served from `/public/crests/{faction}.png` (sourced from
 * heroes.thelazy.net's town-portrait set, native size 48x32).
 *
 * The `size` prop sets the rendered HEIGHT in pixels; width is
 * computed from the 3:2 banner aspect ratio. Pixel-art rendering is
 * preserved with `image-rendering: pixelated` so upscales stay crisp.
 */
const NATIVE_W = 48;
const NATIVE_H = 32;

export function FactionCrest({
  faction,
  size = 28,
  fluid = false,
  withLabel = false,
  className = "",
}: {
  faction: Faction;
  /** Rendered height in pixels. Width follows the 3:2 banner aspect ratio.
   * Ignored when `fluid` is true. */
  size?: number;
  /** Stretch the banner to fill the parent's width and auto-size height
   * via the 3:2 aspect ratio. Use inside a CSS grid so each cell sets
   * the width. */
  fluid?: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const height = size;
  const width = Math.round((size * NATIVE_W) / NATIVE_H);
  return (
    <span
      className={`${fluid ? "block w-full" : "inline-flex items-center gap-1.5"} ${className}`}
      title={FACTION_LABEL[faction]}
    >
      <Image
        src={`/crests/${faction}.png`}
        alt={FACTION_LABEL[faction]}
        width={fluid ? NATIVE_W : width}
        height={fluid ? NATIVE_H : height}
        className={`select-none drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${
          fluid ? "h-auto w-full" : ""
        }`}
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
      {withLabel && !fluid && (
        <span className="text-xs text-ink-soft">{FACTION_LABEL[faction]}</span>
      )}
    </span>
  );
}
