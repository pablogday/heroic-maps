import Link from "next/link";
import { RatingBadge } from "./RatingBadge";
import { FactionCrest } from "./FactionCrest";
import { MapThumbnail } from "./MapThumbnail";
import { BookmarkButton } from "./BookmarkButton";
import { SIZE_LABEL, versionLabel, type Size } from "@/lib/map-constants";
import type { Faction } from "@/lib/factions";
import type { MapCardData } from "@/lib/maps";

/**
 * The one and only map card. Used on /maps (grid view), homepage Top
 * Rated, /library, and "Maps like this" on the detail page.
 */
export function MapCard({
  map,
  signedIn,
  badge,
  showDescription = true,
  imageSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  className = "",
  style,
}: {
  map: MapCardData;
  signedIn: boolean;
  /** Optional small node rendered in the meta row (e.g. play outcome). */
  badge?: React.ReactNode;
  showDescription?: boolean;
  imageSizes?: string;
  /** Extra classes appended to the root article (e.g. stagger animation). */
  className?: string;
  /** Inline style for things like animation-delay. */
  style?: React.CSSProperties;
}) {
  return (
    <article
      className={`card-brass flex flex-col overflow-hidden rounded ${className}`}
      style={style}
    >
      <MapThumbnail
        previewKey={map.previewKey}
        undergroundPreviewKey={map.undergroundPreviewKey}
        name={map.name}
        hasUnderground={map.hasUnderground}
        sizes={imageSizes}
      />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-soft">
          <span className="truncate" title={map.version}>
            {versionLabel(map.version)}
          </span>
          <RatingBadge
            ratingSum={map.ratingSum}
            ratingCount={map.ratingCount}
          />
        </div>
        <h3 className="font-display text-lg leading-tight text-ink">
          {map.name}
        </h3>
        {map.factions && map.factions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(map.factions as Faction[]).slice(0, 6).map((f) => (
              <FactionCrest key={f} faction={f} size={18} />
            ))}
          </div>
        )}
        {showDescription && (
          <p className="mt-2 line-clamp-3 text-sm text-ink-soft flex-1">
            {map.description ?? "No description provided."}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
          <span>
            {SIZE_LABEL[map.size as Size]} · {map.humanPlayers}–
            {map.totalPlayers}P
          </span>
          {badge ?? <span>↓ {map.downloadCount.toLocaleString()}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <a
            href={`/api/maps/${map.id}/download`}
            title="Download map"
            aria-label={`Download ${map.name}`}
            className="hidden h-9 w-9 items-center justify-center rounded border border-brass/50 text-ink-soft transition-colors hover:bg-brass/20 hover:text-ink sm:inline-flex"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V1.75A.75.75 0 0 1 8 1Z" />
              <path d="M2.75 12a.75.75 0 0 1 .75.75v.75a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75v-.75a.75.75 0 0 1 1.5 0v.75A2.25 2.25 0 0 1 11.75 15.75h-7.5A2.25 2.25 0 0 1 2 13.5v-.75A.75.75 0 0 1 2.75 12Z" />
            </svg>
          </a>
          <div className="flex items-center gap-2">
            <BookmarkButton
              mapId={map.id}
              slug={map.slug}
              initial={map.bookmarked}
              signedIn={signedIn}
            />
            <Link
              href={`/maps/${map.slug}`}
              className="rounded border border-brass/50 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-brass/20"
            >
              View map
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
