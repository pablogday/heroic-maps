import type { ReactNode } from "react";

/**
 * Brass-bordered panel with an uppercase tracked heading. The most
 * common card shape on the site — used in the map detail sidebar
 * (Specs, Conditions, Towns, Map contents, Playthroughs, Origin),
 * the campaign block, the library / profile / admin shells, etc.
 *
 * Wraps the `card-brass` recipe + heading typography in one place so
 * tracking values stop drifting (`tracking-[0.15em]` vs
 * `tracking-[0.2em]`) and the heading-vs-content gap stays uniform.
 *
 * Usage:
 *   <SectionCard title="Towns">{children}</SectionCard>
 *   <SectionCard title="Map contents" trailing={<ParserSourceLink />}>
 *     {children}
 *   </SectionCard>
 *
 * For the few callers that need the heading turned off (e.g. the
 * preview-image card), pass `title={null}`.
 */
export function SectionCard({
  title,
  trailing,
  children,
  className = "",
  /** Override the default `p-5`. Some callers (the campaign scenarios
   * list) want a different inner padding to match a denser layout. */
  innerClassName = "",
}: {
  title: string | null;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const padding = innerClassName || "p-5";
  return (
    <div className={`card-brass rounded ${padding} ${className}`}>
      {title !== null && (
        <div className="mb-3 flex items-center gap-1.5">
          <h3 className="font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
            {title}
          </h3>
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}
