"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Map preview thumbnail. When the map has an underground level we float
 * a small toggle in the top-right that swaps between surface and
 * underground views. Designed for grid-card aspect-square use; the
 * `sizes` and `priority` props pass through to next/image.
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

  if (!previewKey) {
    return <div className="aspect-square w-full bg-night-deep" />;
  }

  const src =
    showUnder && hasUnderground
      ? previewKey.replace("/img/", "/img_und/")
      : previewKey;

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-night-deep">
      <Image
        src={src}
        alt={`${name} — ${showUnder ? "underground" : "surface"} preview`}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        unoptimized
      />
      {hasUnderground && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowUnder((v) => !v);
          }}
          aria-pressed={showUnder}
          title={showUnder ? "Show surface" : "Show underground"}
          className="absolute right-2 top-2 inline-flex w-[112px] items-center justify-center gap-2 rounded border border-brass/70 bg-night-deep/85 px-2.5 py-1.5 text-xs font-display uppercase tracking-wider text-parchment shadow-md backdrop-blur-sm transition-colors hover:bg-night-deep"
        >
          {/* switch glyph */}
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
