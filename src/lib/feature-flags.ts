/**
 * Build-time feature flags. Read from `NEXT_PUBLIC_*` env vars so the
 * value is inlined into both server and client bundles. To flip a
 * flag, change the env in `.env.local` (dev) or in Vercel project
 * settings (prod) and redeploy.
 *
 * Add new flags here rather than reading env vars directly from
 * components — keeps the surface auditable and the defaults explicit.
 */

/** Which crest renderer to use site-wide. `pixel` = real HoMM3 banner
 * PNGs (default), `svg` = original hand-rolled SVG glyphs. */
export type FactionCrestStyle = "pixel" | "svg";

export function factionCrestStyle(): FactionCrestStyle {
  const v = process.env.NEXT_PUBLIC_FACTION_CREST_STYLE;
  return v === "svg" ? "svg" : "pixel";
}
