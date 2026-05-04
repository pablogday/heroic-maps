/**
 * Build-time feature flags. Read from `NEXT_PUBLIC_*` env vars so the
 * value is inlined into both server and client bundles. To flip a
 * flag, change the env in `.env.local` (dev) or in Vercel project
 * settings (prod) and redeploy.
 *
 * Add new flags here rather than reading env vars directly from
 * components — keeps the surface auditable and the defaults explicit.
 */

/** Which crest renderer to use site-wide. `svg` = original hand-drawn
 * shield glyphs (current default), `pixel` = real Heroes 3 banner
 * PNGs. Flip via `NEXT_PUBLIC_FACTION_CREST_STYLE=pixel`. */
export type FactionCrestStyle = "pixel" | "svg";

export function factionCrestStyle(): FactionCrestStyle {
  const v = process.env.NEXT_PUBLIC_FACTION_CREST_STYLE;
  return v === "pixel" ? "pixel" : "svg";
}
