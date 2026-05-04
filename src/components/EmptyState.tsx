import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Themed empty state — the visual cousin of `<ScrollLoader>`. Same
 * brass-bordered parchment-shimmer card, but fixed in place rather
 * than animating. Use anywhere a feed/list comes back empty.
 *
 * Two ways to drive the icon spot:
 *   - `icon`   — a ReactNode (typically a brass-tinted SVG from
 *                `nav-icons` or `StatIcon`). Preferred.
 *   - `glyph`  — a single emoji string. Legacy fallback for spots
 *                that haven't been swapped yet.
 *
 * Copy:
 *   - `title` — short headline. Required.
 *   - `body`  — supporting line, optional.
 *   - `cta`   — { href, label } for an action button, optional.
 *
 * The component picks brass-themed flavor wording at the call site;
 * it doesn't impose any tone of its own. Keep the title under ~30
 * chars so the card stays balanced.
 */
export function EmptyState({
  glyph,
  icon,
  title,
  body,
  cta,
}: {
  glyph?: string;
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-12"
      role="status"
    >
      {icon ? (
        <div className="text-brass" aria-hidden>
          {icon}
        </div>
      ) : glyph ? (
        <div className="text-5xl opacity-80" aria-hidden>
          {glyph}
        </div>
      ) : null}
      <div className="card-brass relative w-full max-w-md overflow-hidden rounded p-6 text-center">
        <div
          className="parchment-shimmer absolute inset-0 opacity-30"
          aria-hidden
        />
        {/* Brass corner ornaments — subtle "scroll" hint that the
          * loader's `<Torch>` provides through animation. Kept as
          * pseudo-corners with linear-gradient strips so the shape
          * reads on both light and dark backgrounds. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-2 h-px bg-gradient-to-r from-transparent via-brass/50 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 bottom-2 h-px bg-gradient-to-r from-transparent via-brass/50 to-transparent"
        />
        <div className="relative">
          <h3 className="font-display text-lg text-ink">{title}</h3>
          {body && <p className="mt-2 text-sm text-ink-soft">{body}</p>}
          {cta && (
            <Link
              href={cta.href}
              className="btn-brass mt-4 inline-block rounded px-4 py-1.5 text-sm font-display"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
