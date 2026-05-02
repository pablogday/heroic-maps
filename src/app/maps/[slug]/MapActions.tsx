"use client";

import { useState, useTransition } from "react";
import { toggleFavorite, toggleBookmark } from "@/app/actions/library";

export function MapActions({
  mapId,
  slug,
  initial,
  hasPlayed,
  onLogClick,
}: {
  mapId: number;
  slug: string;
  initial: { favorited: boolean; bookmarked: boolean };
  hasPlayed: boolean;
  onLogClick: () => void;
}) {
  const [favorited, setFav] = useState(initial.favorited);
  const [bookmarked, setBm] = useState(initial.bookmarked);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        aria-pressed={favorited}
        disabled={pending}
        onClick={() => {
          const next = !favorited;
          setFav(next);
          startTransition(async () => {
            const res = await toggleFavorite(mapId, slug, next);
            if (!res.ok) setFav(!next);
          });
        }}
        className={`rounded border px-2 py-2 text-xs font-display transition-colors ${
          favorited
            ? "border-blood bg-blood/15 text-blood"
            : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
        }`}
        title={favorited ? "Remove from favorites" : "Add to favorites"}
      >
        <span className="block text-base leading-none">
          {favorited ? "♥" : "♡"}
        </span>
        <span className="mt-0.5 block">Favorite</span>
      </button>

      <button
        type="button"
        aria-pressed={bookmarked}
        disabled={pending}
        onClick={() => {
          const next = !bookmarked;
          setBm(next);
          startTransition(async () => {
            const res = await toggleBookmark(mapId, slug, next);
            if (!res.ok) setBm(!next);
          });
        }}
        className={`rounded border px-2 py-2 text-xs font-display transition-colors ${
          bookmarked
            ? "border-brass-bright bg-brass/30 text-ink"
            : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark for later"}
      >
        <span className="block text-base leading-none">
          {bookmarked ? "🔖" : "📑"}
        </span>
        <span className="mt-0.5 block">Bookmark</span>
      </button>

      <button
        type="button"
        onClick={onLogClick}
        className={`rounded border px-2 py-2 text-xs font-display transition-colors ${
          hasPlayed
            ? "border-emerald bg-emerald/15 text-emerald"
            : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
        }`}
        title={hasPlayed ? "Log another playthrough" : "Log a playthrough"}
      >
        <span className="block text-base leading-none">⚔</span>
        <span className="mt-0.5 block">{hasPlayed ? "Log again" : "Played"}</span>
      </button>
    </div>
  );
}
