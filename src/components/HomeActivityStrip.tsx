/**
 * The two side-by-side activity cards on the homepage. Each card has
 * its own async fetch so React can stream them in independently of
 * the hero / featured grid via <Suspense> boundaries on the page.
 *
 * Skeleton fallbacks keep the layout stable while the queries
 * resolve — important on first cold-cache visit where the Neon
 * round-trip is the long pole.
 */
import Link from "next/link";
import Image from "next/image";
import { getRecentlyAdded, getRecentlyReviewed } from "@/lib/maps";
import { versionLabel } from "@/lib/map-constants";
import { formatRelativeTime } from "@/lib/relative-time";
import { RatingStars } from "./RatingStars";

const ROW_COUNT = 4;

export async function RecentlyAddedCard() {
  const items = await getRecentlyAdded(ROW_COUNT);
  return (
    <div className="card-brass rounded p-5">
      <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
        ✦ Newly added
      </h3>
      <ul className="divide-y divide-brass/20">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/maps/${m.slug}`}
              className="flex items-center gap-3 py-2 hover:text-blood"
            >
              {m.previewKey ? (
                <Image
                  src={m.previewKey}
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
                <div className="truncate text-sm font-medium text-ink group-hover:text-blood">
                  {m.name}
                </div>
                <div className="text-xs text-ink-soft">
                  {versionLabel(m.version)} ·{" "}
                  {formatRelativeTime(m.addedAt)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function RecentlyReviewedCard() {
  const items = await getRecentlyReviewed(ROW_COUNT);
  return (
    <div className="card-brass rounded p-5">
      <h3 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
        ✦ Latest reviews
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No reviews yet — be the first.
        </p>
      ) : (
        <ul className="divide-y divide-brass/20">
          {items.map((r) => (
            <li key={r.reviewId} className="py-2">
              <Link
                href={`/maps/${r.mapSlug}`}
                className="flex items-start gap-3 hover:text-blood"
              >
                {r.authorImage ? (
                  <Image
                    src={r.authorImage}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 flex-shrink-0 rounded-full border border-brass/40"
                    unoptimized
                  />
                ) : (
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-brass/30" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {r.mapName}
                    </span>
                    <RatingStars rating={r.rating} />
                  </div>
                  <div className="text-xs text-ink-soft">
                    {r.authorName ?? "Anonymous"} ·{" "}
                    {formatRelativeTime(r.createdAt)}
                  </div>
                  {r.body && (
                    <div className="mt-1 line-clamp-2 text-xs text-ink-soft/80">
                      {r.body}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Stable-height skeleton for the "Newly added" card. Renders ROW_COUNT
 * rows so the layout doesn't jump when real data arrives. */
export function RecentlyAddedSkeleton() {
  return (
    <div className="card-brass rounded p-5" aria-hidden>
      <div className="mb-3 h-3 w-28 rounded bg-brass/25" />
      <ul className="divide-y divide-brass/20">
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 py-2">
            <div className="parchment-shimmer h-10 w-10 flex-shrink-0 rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="parchment-shimmer h-3 w-3/4 rounded" />
              <div className="parchment-shimmer h-2.5 w-1/3 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mirror skeleton for "Latest reviews". Slightly taller rows since
 * each row has author avatar + rating + 2-line excerpt. */
export function RecentlyReviewedSkeleton() {
  return (
    <div className="card-brass rounded p-5" aria-hidden>
      <div className="mb-3 h-3 w-28 rounded bg-brass/25" />
      <ul className="divide-y divide-brass/20">
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 py-2">
            <div className="parchment-shimmer h-8 w-8 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="parchment-shimmer h-3 w-2/3 rounded" />
              <div className="parchment-shimmer h-2.5 w-2/5 rounded" />
              <div className="parchment-shimmer h-2.5 w-full rounded" />
              <div className="parchment-shimmer h-2.5 w-4/5 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
