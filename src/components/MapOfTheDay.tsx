/**
 * Daily featured map block on the homepage. Selection is server-
 * driven (`getMapOfTheDay`) and rotates at midnight UTC. Renders as
 * a wide horizontal card so it sits between the hero and the activity
 * strip without competing with the featured grid.
 *
 * Wraps `<Suspense>` upstream so the homepage paints without waiting
 * on this query — the layout reserves space and the card slides in
 * once Neon answers.
 */
import Link from "next/link";
import Image from "next/image";

import { getMapOfTheDay } from "@/lib/maps";
import { SIZE_LABEL, versionLabel, type Size } from "@/lib/map-constants";
import { RatingStars } from "./RatingStars";

export async function MapOfTheDayCard({ viewerId }: { viewerId: string | null }) {
  const map = await getMapOfTheDay(viewerId);
  if (!map) return null;

  const avg =
    map.ratingCount > 0 ? (map.ratingSum / map.ratingCount).toFixed(1) : null;

  return (
    <Link
      href={`/maps/${map.slug}`}
      className="card-brass group flex flex-col overflow-hidden rounded transition-shadow hover:shadow-lg sm:flex-row"
    >
      {/* Preview thumbnail — square on desktop, wider banner on mobile. */}
      <div className="relative aspect-[16/9] w-full flex-none overflow-hidden bg-night-deep sm:aspect-square sm:w-56">
        {map.previewKey ? (
          <Image
            src={map.previewKey}
            alt={map.name}
            fill
            sizes="(max-width: 640px) 100vw, 224px"
            className="object-cover pixelated transition-transform duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-night-deep" />
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="font-display text-[11px] uppercase tracking-[0.2em] text-brass">
            ✦ Map of the day
          </span>
          {avg && (
            <span className="text-xs text-ink-soft">
              <RatingStars rating={Number(avg)} /> {avg} · {map.ratingCount}
            </span>
          )}
        </div>
        <h3 className="font-display text-2xl text-ink leading-tight">
          {map.name}
        </h3>
        <div className="mt-1 text-xs text-ink-soft">
          {versionLabel(map.version)} · {SIZE_LABEL[map.size as Size]} ·{" "}
          {map.humanPlayers}–{map.totalPlayers}P
        </div>
        {map.description && (
          <p className="mt-2 line-clamp-3 text-sm text-ink-soft/90">
            {map.description}
          </p>
        )}
        <div className="mt-3 flex items-baseline justify-between text-xs text-ink-soft">
          <span>↓ {map.downloadCount.toLocaleString()}</span>
          <span className="text-blood transition-colors group-hover:text-brass-bright">
            View map →
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Skeleton placeholder while the daily query resolves. Layout
 * matches the final card so nothing jumps when the data arrives. */
export function MapOfTheDaySkeleton() {
  return (
    <div
      aria-hidden
      className="card-brass flex flex-col overflow-hidden rounded sm:flex-row"
    >
      <div className="parchment-shimmer aspect-[16/9] w-full flex-none bg-night-deep/30 sm:aspect-square sm:w-56" />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="parchment-shimmer h-2.5 w-28 rounded" />
          <div className="parchment-shimmer h-3 w-20 rounded" />
        </div>
        <div className="parchment-shimmer h-6 w-2/3 rounded" />
        <div className="parchment-shimmer mt-2 h-3 w-1/3 rounded" />
        <div className="mt-3 space-y-1.5">
          <div className="parchment-shimmer h-3 w-full rounded" />
          <div className="parchment-shimmer h-3 w-5/6 rounded" />
          <div className="parchment-shimmer h-3 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}
