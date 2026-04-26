"use client";

import { useState, useTransition } from "react";
import {
  toggleFavorite,
  toggleBookmark,
  setPlayed,
  type PlayedOutcome,
} from "@/app/actions/library";

const OUTCOME_LABEL: Record<PlayedOutcome, string> = {
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

export function MapActions({
  mapId,
  slug,
  initial,
}: {
  mapId: number;
  slug: string;
  initial: {
    favorited: boolean;
    bookmarked: boolean;
    playedOutcome: PlayedOutcome | null;
  };
}) {
  const [favorited, setFav] = useState(initial.favorited);
  const [bookmarked, setBm] = useState(initial.bookmarked);
  const [outcome, setOutcome] = useState<PlayedOutcome | null>(
    initial.playedOutcome
  );
  const [openMenu, setOpenMenu] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        aria-pressed={favorited}
        disabled={pending}
        onClick={() => {
          const next = !favorited;
          setFav(next); // optimistic
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

      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={openMenu}
          disabled={pending}
          onClick={() => setOpenMenu((v) => !v)}
          className={`w-full rounded border px-2 py-2 text-xs font-display transition-colors ${
            outcome
              ? "border-emerald bg-emerald/15 text-emerald"
              : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
          }`}
          title={
            outcome ? `You played: ${OUTCOME_LABEL[outcome]}` : "I played this"
          }
        >
          <span className="block text-base leading-none">⚔</span>
          <span className="mt-0.5 block">
            {outcome ? OUTCOME_LABEL[outcome] : "Played"}
          </span>
        </button>

        {openMenu && (
          <div
            role="menu"
            className="card-brass absolute right-0 top-full z-10 mt-1 w-44 rounded p-1 text-sm shadow-lg"
          >
            {(Object.keys(OUTCOME_LABEL) as PlayedOutcome[]).map((o) => (
              <button
                key={o}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOutcome(o);
                  setOpenMenu(false);
                  startTransition(async () => {
                    const res = await setPlayed(mapId, slug, o);
                    if (!res.ok) setOutcome(initial.playedOutcome);
                  });
                }}
                className={`block w-full rounded px-3 py-1.5 text-left hover:bg-brass/20 ${
                  outcome === o ? "text-emerald" : "text-ink"
                }`}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
            {outcome && (
              <>
                <div className="my-1 h-px bg-brass/30" />
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOutcome(null);
                    setOpenMenu(false);
                    startTransition(async () => {
                      const res = await setPlayed(mapId, slug, null);
                      if (!res.ok) setOutcome(initial.playedOutcome);
                    });
                  }}
                  className="block w-full rounded px-3 py-1.5 text-left text-blood hover:bg-blood/10"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
