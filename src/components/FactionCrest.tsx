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
  withLabel = false,
  className = "",
}: {
  faction: Faction;
  /** Rendered height in pixels. Width follows the 3:2 banner aspect ratio. */
  size?: number;
  withLabel?: boolean;
  className?: string;
}) {
  const height = size;
  const width = Math.round((size * NATIVE_W) / NATIVE_H);
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={FACTION_LABEL[faction]}
    >
      <Image
        src={`/crests/${faction}.png`}
        alt={FACTION_LABEL[faction]}
        width={width}
        height={height}
        className="select-none drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
      {withLabel && (
        <span className="text-xs text-ink-soft">{FACTION_LABEL[faction]}</span>
      )}
    </span>
  );
}
