"use client";

import { useState, useTransition } from "react";
import { toggleBookmark } from "@/app/actions/library";
import { IconBookmark, IconPlayed } from "@/components/nav-icons";
import { toast } from "@/lib/toast";

/**
 * Sidebar actions on the map detail page. Two buttons since the
 * Path-1 collapse: Bookmark (private save) + Played (open the
 * playthrough journal). Favorite was folded into Bookmark in
 * migration 0011 — see schema.ts.
 */
export function MapActions({
  mapId,
  slug,
  initial,
  hasPlayed,
  onLogClick,
}: {
  mapId: number;
  slug: string;
  initial: { bookmarked: boolean };
  hasPlayed: boolean;
  onLogClick: () => void;
}) {
  const [bookmarked, setBm] = useState(initial.bookmarked);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        aria-pressed={bookmarked}
        disabled={pending}
        onClick={() => {
          const next = !bookmarked;
          setBm(next);
          startTransition(async () => {
            const res = await toggleBookmark(mapId, slug, next);
            if (!res.ok) {
              setBm(!next);
              toast.error(res.error);
              return;
            }
            toast.info(next ? "Bookmarked." : "Bookmark removed.", 2000);
          });
        }}
        className={`rounded border px-2 py-2 text-xs font-display transition-colors ${
          bookmarked
            ? "border-brass-bright bg-brass/30 text-ink"
            : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark for later"}
      >
        <span className="mx-auto block w-fit">
          <IconBookmark size={18} />
        </span>
        <span className="mt-1 block">Bookmark</span>
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
        <span className="mx-auto block w-fit">
          <IconPlayed size={18} />
        </span>
        <span className="mt-1 block">{hasPlayed ? "Log again" : "Played"}</span>
      </button>
    </div>
  );
}
