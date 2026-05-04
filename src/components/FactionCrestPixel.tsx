import Image from "next/image";
import { FACTION_LABEL, type Faction } from "@/lib/factions";

/**
 * Pixel-art town banner — the actual in-game town portrait sprite
 * from Heroes 3 (48x32 PNG, sourced from heroes.thelazy.net).
 *
 * Selected when the `factionCrestStyle()` feature flag is `pixel`
 * (default). For the alternative hand-drawn style, see
 * `FactionCrestSvg`.
 */
const NATIVE_W = 48;
const NATIVE_H = 32;

export function FactionCrestPixel({
  faction,
  size = 28,
  fluid = false,
  withLabel = false,
  className = "",
}: {
  faction: Faction;
  size?: number;
  fluid?: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const height = size;
  const width = Math.round((size * NATIVE_W) / NATIVE_H);
  return (
    <span
      className={`${
        fluid ? "block w-full" : "inline-flex items-center gap-1.5"
      } ${className}`}
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
