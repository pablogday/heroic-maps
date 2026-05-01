import Link from "next/link";
import Image from "next/image";

type SeriesKind = "sequel" | "variant" | "remake";

type Series = {
  id: number;
  slug: string;
  name: string;
  kind: SeriesKind;
  description: string | null;
};

type Sibling = {
  id: number;
  slug: string;
  name: string;
  version: string;
  previewKey: string | null;
  seriesPosition: number | null;
};

const KIND_META: Record<
  SeriesKind,
  { label: string; intro: (s: string) => string; icon: string }
> = {
  sequel: {
    label: "Series",
    intro: (s) => `Part of ${s}`,
    icon: "✦",
  },
  variant: {
    label: "Variants",
    intro: (s) => `Difficulty variants of ${s}`,
    icon: "⚜",
  },
  remake: {
    label: "Remakes",
    intro: (s) => `Other versions of ${s}`,
    icon: "↻",
  },
};

/**
 * "Part of X" panel rendered on the map detail page above
 * "Maps like this". Sequel layout is a numbered timeline with prev/next
 * nav; variant/remake layouts are simple grouped lists.
 */
export function SeriesBlock({
  series,
  siblings,
  thisMapId,
  thisPosition,
}: {
  series: Series;
  siblings: Sibling[];
  thisMapId: number;
  thisPosition: number | null;
}) {
  const meta = KIND_META[series.kind];
  const others = siblings.filter((s) => s.id !== thisMapId);

  return (
    <section className="card-brass mt-10 rounded p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brass">
            {meta.icon} {meta.label}
          </div>
          <h2 className="font-display text-xl text-ink truncate">
            {meta.intro(series.name)}
          </h2>
        </div>
        <Link
          href={`/series/${series.slug}`}
          className="shrink-0 text-sm text-blood hover:underline"
        >
          See all →
        </Link>
      </header>

      {series.kind === "sequel" ? (
        <SequelTimeline
          siblings={siblings}
          thisMapId={thisMapId}
          thisPosition={thisPosition}
        />
      ) : (
        <SiblingList siblings={others} />
      )}
    </section>
  );
}

function SequelTimeline({
  siblings,
  thisMapId,
  thisPosition,
}: {
  siblings: Sibling[];
  thisMapId: number;
  thisPosition: number | null;
}) {
  // Find adjacent siblings by position. We assume the list is already
  // sorted ASC NULLS LAST from `getSeriesContext`.
  const idx = siblings.findIndex((s) => s.id === thisMapId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <>
      {/* Prev / current / next strip */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SequelSlot direction="prev" sibling={prev} />
        <SequelSlot direction="current" />
        <SequelSlot direction="next" sibling={next} />
      </div>

      {/* Full series ladder */}
      <ol className="mt-5 flex flex-wrap gap-2 text-xs">
        {siblings.map((s) => {
          const isCurrent = s.id === thisMapId;
          return (
            <li key={s.id}>
              <Link
                href={`/maps/${s.slug}`}
                aria-current={isCurrent ? "page" : undefined}
                title={s.name}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 transition-colors ${
                  isCurrent
                    ? "border-brass-bright bg-brass/30 text-ink"
                    : "border-brass/40 text-ink-soft hover:bg-brass/15 hover:text-ink"
                }`}
              >
                <span className="font-display text-brass">
                  {s.seriesPosition ?? "—"}
                </span>
                <span className="max-w-[180px] truncate">{s.name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function SequelSlot({
  direction,
  sibling,
}: {
  direction: "prev" | "current" | "next";
  sibling?: Sibling | null;
}) {
  if (direction === "current") {
    return (
      <div className="rounded border border-dashed border-brass/40 bg-parchment-dark/30 p-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-ink-soft">
          You are here
        </div>
      </div>
    );
  }
  if (!sibling) {
    return (
      <div className="rounded border border-brass/20 p-3 text-center text-xs text-ink-soft/50">
        {direction === "prev" ? "← (start of series)" : "(end of series) →"}
      </div>
    );
  }
  return (
    <Link
      href={`/maps/${sibling.slug}`}
      className="group flex items-center gap-3 rounded border border-brass/40 p-3 hover:bg-brass/10"
    >
      <span className="font-display text-base text-brass shrink-0">
        {direction === "prev" ? "←" : ""}
      </span>
      {sibling.previewKey ? (
        <Image
          src={sibling.previewKey}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0 rounded object-cover pixelated bg-night-deep"
          unoptimized
        />
      ) : (
        <div className="h-10 w-10 flex-shrink-0 rounded bg-night-deep" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-ink-soft">
          {direction === "prev" ? "Previous" : "Next"}
          {sibling.seriesPosition != null
            ? ` · #${sibling.seriesPosition}`
            : ""}
        </div>
        <div className="truncate text-sm font-display text-ink group-hover:text-blood">
          {sibling.name}
        </div>
      </div>
      <span className="font-display text-base text-brass shrink-0">
        {direction === "next" ? "→" : ""}
      </span>
    </Link>
  );
}

function SiblingList({ siblings }: { siblings: Sibling[] }) {
  if (siblings.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        No other entries in this series yet.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {siblings.map((s) => (
        <li key={s.id}>
          <Link
            href={`/maps/${s.slug}`}
            className="group flex items-center gap-3 rounded border border-brass/40 p-2 hover:bg-brass/10"
          >
            {s.previewKey ? (
              <Image
                src={s.previewKey}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 flex-shrink-0 rounded object-cover pixelated bg-night-deep"
                unoptimized
              />
            ) : (
              <div className="h-10 w-10 flex-shrink-0 rounded bg-night-deep" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-display text-ink group-hover:text-blood">
                {s.name}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                {s.version}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
