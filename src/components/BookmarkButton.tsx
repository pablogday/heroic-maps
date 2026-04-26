"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toggleBookmark } from "@/app/actions/library";

/**
 * Compact bookmark toggle used inside cards. Optimistic with rollback,
 * routes signed-out users to Discord sign-in.
 */
export function BookmarkButton({
  mapId,
  slug,
  initial,
  signedIn,
}: {
  mapId: number;
  slug: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={bookmarked}
      disabled={pending}
      title={
        !signedIn
          ? "Sign in to bookmark"
          : bookmarked
            ? "Remove bookmark"
            : "Bookmark for later"
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!signedIn) {
          signIn("discord");
          return;
        }
        const next = !bookmarked;
        setBookmarked(next);
        startTransition(async () => {
          const res = await toggleBookmark(mapId, slug, next);
          if (!res.ok) setBookmarked(!next);
        });
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded border transition-colors ${
        bookmarked
          ? "border-brass-bright bg-brass/30 text-ink"
          : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
      }`}
    >
      <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden>
        {bookmarked ? (
          <path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h7A1.5 1.5 0 0 1 12 1.5v13.25a.75.75 0 0 1-1.2.6L7 12.55l-3.8 2.8a.75.75 0 0 1-1.2-.6V1.5Z" />
        ) : (
          <path d="M3.5 0A1.5 1.5 0 0 0 2 1.5v13.25a.75.75 0 0 0 1.2.6L7 12.55l3.8 2.8a.75.75 0 0 0 1.2-.6V1.5A1.5 1.5 0 0 0 10.5 0h-7Zm0 1.5h7v12.07L7.45 11.4a.75.75 0 0 0-.9 0L3.5 13.57V1.5Z" />
        )}
      </svg>
    </button>
  );
}
