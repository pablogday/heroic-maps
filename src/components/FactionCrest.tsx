import { factionCrestStyle } from "@/lib/feature-flags";
import { FactionCrestPixel } from "./FactionCrestPixel";
import { FactionCrestSvg } from "./FactionCrestSvg";
import type { Faction } from "@/lib/factions";

/**
 * Public crest API. Picks the renderer based on the
 * `factionCrestStyle()` feature flag (env-driven). Two implementations
 * coexist:
 *
 *   - `FactionCrestPixel` — extracted Heroes 3 town banner PNGs.
 *     Default. Authentic look, requires shipping the asset folder.
 *   - `FactionCrestSvg` — original layered SVG glyphs with embossed
 *     panels. Themed to the brass/parchment palette.
 *
 * Flip via `NEXT_PUBLIC_FACTION_CREST_STYLE=svg` (or `pixel`). Both
 * components share the prop surface so callers don't need to care.
 */
export interface FactionCrestProps {
  faction: Faction;
  /** Rendered height (or width when fluid). Default 28. */
  size?: number;
  /** Stretch to parent's width using the native aspect ratio. Use
   * inside a CSS grid to drive sizing from the cell. */
  fluid?: boolean;
  /** Append the faction's display name next to the crest. */
  withLabel?: boolean;
  className?: string;
}

export function FactionCrest(props: FactionCrestProps) {
  return factionCrestStyle() === "svg" ? (
    <FactionCrestSvg {...props} />
  ) : (
    <FactionCrestPixel {...props} />
  );
}
