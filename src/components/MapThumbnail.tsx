"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Map preview thumbnail. Shows a themed parchment placeholder while the
 * remote image loads, then fades it out. When the map has an underground
 * level we float a toggle in the top-right that swaps between surface
 * and underground views.
 */
export function MapThumbnail({
  previewKey,
  name,
  hasUnderground,
  sizes,
  priority,
  className = "object-cover pixelated",
}: {
  previewKey: string | null;
  name: string;
  hasUnderground: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [showUnder, setShowUnder] = useState(false);
  // Re-enter loading state when the src swaps between surface/underground.
  const [loaded, setLoaded] = useState(false);

  if (!previewKey) {
    return <div className="aspect-square w-full bg-night-deep" />;
  }

  const src =
    showUnder && hasUnderground
      ? previewKey.replace("/img/", "/img_und/")
      : previewKey;

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-night-deep">
      {/* Themed placeholder — parchment shimmer + a brass shield glyph.
          Sits behind the Image; fades out once the image fires onLoad. */}
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="parchment-shimmer absolute inset-0" />
        <ShieldGlyph />
      </div>

      <Image
        // Force React to remount the <img> when src toggles so onLoad
        // always fires for the new request.
        key={src}
        src={src}
        alt={`${name} — ${showUnder ? "underground" : "surface"} preview`}
        fill
        sizes={sizes}
        priority={priority}
        className={`${className} transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        unoptimized
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />

      {hasUnderground && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLoaded(false);
            setShowUnder((v) => !v);
          }}
          aria-pressed={showUnder}
          title={showUnder ? "Show surface" : "Show underground"}
          className="absolute right-2 top-2 inline-flex w-[112px] items-center justify-center gap-2 rounded border border-brass/70 bg-night-deep/85 px-2.5 py-1.5 text-xs font-display uppercase tracking-wider text-parchment shadow-md backdrop-blur-sm transition-colors hover:bg-night-deep"
        >
          <svg width="22" height="14" viewBox="0 0 28 16" aria-hidden>
            <rect
              x="1"
              y="1"
              width="26"
              height="14"
              rx="7"
              fill={showUnder ? "#3a2a4e" : "#3f8a4f"}
              stroke="#b88a3a"
              strokeWidth="1.5"
            />
            <circle
              cx={showUnder ? 21 : 7}
              cy="8"
              r="4.5"
              fill="#e0b656"
              stroke="#231509"
              strokeWidth="0.8"
            />
          </svg>
          <span className="w-12 text-left">
            {showUnder ? "Under" : "Surface"}
          </span>
        </button>
      )}
    </div>
  );
}

/** Centered medieval shield silhouette used in the loading placeholder. */
function ShieldGlyph() {
  return (
    <svg
      width="40"
      height="46"
      viewBox="0 0 40 46"
      aria-hidden
      className="relative animate-pulse"
    >
      <path
        d="M3 4 L20 1.5 L37 4 L36 22 C 35 33, 28 40, 20 44 C 12 40, 5 33, 4 22 Z"
        fill="rgba(184, 138, 58, 0.25)"
        stroke="rgba(184, 138, 58, 0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner cross-hilt sword to keep the parchment-shimmer from
          looking empty. */}
      <g
        fill="rgba(42, 26, 13, 0.45)"
        transform="translate(20 22)"
      >
        <rect x="-0.8" y="-9" width="1.6" height="18" />
        <rect x="-5" y="-5" width="10" height="1.8" />
      </g>
    </svg>
  );
}
