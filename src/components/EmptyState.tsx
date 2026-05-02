import Link from "next/link";

/**
 * Themed empty state — a parchment-shimmer card with a glyph, title,
 * subtitle, and an optional CTA. Visual cousin of ScrollLoader so
 * empty/loading states share a feel.
 */
export function EmptyState({
  glyph = "📜",
  title,
  body,
  cta,
}: {
  glyph?: string;
  title: string;
  body?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16"
      role="status"
    >
      <div className="text-5xl opacity-80" aria-hidden>
        {glyph}
      </div>
      <div className="card-brass relative w-full max-w-md overflow-hidden rounded p-6 text-center">
        <div
          className="parchment-shimmer absolute inset-0 opacity-30"
          aria-hidden
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
