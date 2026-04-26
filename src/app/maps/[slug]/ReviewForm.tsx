"use client";

import { useState, useTransition } from "react";
import { submitReview, deleteReview } from "@/app/actions/reviews";

export function ReviewForm({
  mapId,
  slug,
  initialRating,
  initialBody,
  reviewId,
}: {
  mapId: number;
  slug: string;
  initialRating?: number;
  initialBody?: string | null;
  reviewId?: number;
}) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [body, setBody] = useState<string>(initialBody ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isEdit = reviewId != null;
  const display = hover || rating;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    startTransition(async () => {
      const res = await submitReview(mapId, rating, body, slug);
      if (!res.ok) setError(res.error);
    });
  };

  const handleDelete = () => {
    if (!reviewId) return;
    if (!confirm("Delete your review?")) return;
    startTransition(async () => {
      const res = await deleteReview(reviewId, mapId, slug);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-soft">Your rating:</span>
        <div
          className="flex gap-1"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="Rating"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={`text-2xl leading-none transition-colors ${
                n <= display ? "text-brass-bright" : "text-ink-soft/30"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        {display > 0 && (
          <span className="text-sm text-ink-soft">{display}/5</span>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Optional — what made this map memorable?"
        rows={4}
        maxLength={4000}
        className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brass focus:outline-none"
      />

      {error && <p className="text-sm text-blood">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-brass rounded px-4 py-2 text-sm font-display disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : isEdit
              ? "Update review"
              : "Post review"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded border border-blood/40 px-3 py-2 text-sm text-blood hover:bg-blood/10 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
