"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toggleFavorite } from "@/app/actions/library";

/**
 * Compact favorite toggle for cards. Twin of `<BookmarkButton>` —
 * same dimensions, same optimistic-with-rollback behavior, same
 * sign-in redirect for signed-out users. Pair them in the card
 * footer so signed-in users can flip either flag without leaving
 * the listing.
 *
 * Filled heart when the row is favorited (blood-tinted to read at a
 * glance), outline heart when not.
 */
export function FavoriteButton({
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
  const [favorited, setFavorited] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={favorited}
      disabled={pending}
      title={
        !signedIn
          ? "Sign in to favorite"
          : favorited
            ? "Remove from favorites"
            : "Add to favorites"
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!signedIn) {
          signIn("discord");
          return;
        }
        const next = !favorited;
        setFavorited(next);
        startTransition(async () => {
          const res = await toggleFavorite(mapId, slug, next);
          if (!res.ok) setFavorited(!next);
        });
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded border transition-colors ${
        favorited
          ? "border-blood bg-blood/15 text-blood"
          : "border-brass/50 text-ink-soft hover:bg-brass/15 hover:text-ink"
      }`}
    >
      <svg
        width="15"
        height="14"
        viewBox="0 0 16 14"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 12.5 C 5 10.5, 1 8, 1 4.5 C 1 2.6, 2.5 1.2, 4.2 1.2 C 5.4 1.2, 6.4 1.7, 8 3.4 C 9.6 1.7, 10.6 1.2, 11.8 1.2 C 13.5 1.2, 15 2.6, 15 4.5 C 15 8, 11 10.5, 8 12.5 Z" />
      </svg>
    </button>
  );
}
