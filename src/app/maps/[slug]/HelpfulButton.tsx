"use client";

import { useState, useTransition } from "react";
import { toggleReviewHelpful } from "@/app/actions/reviews";

export function HelpfulButton({
  reviewId,
  slug,
  initialCount,
  initialReacting,
  signedIn,
}: {
  reviewId: number;
  slug: string;
  initialCount: number;
  initialReacting: boolean;
  signedIn: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [reacting, setReacting] = useState(initialReacting);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!signedIn) return;
    // Optimistic
    const wasReacting = reacting;
    const next = !wasReacting;
    setReacting(next);
    setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    startTransition(async () => {
      const res = await toggleReviewHelpful(reviewId, slug);
      if (!res.ok) {
        setReacting(wasReacting);
        setCount((c) => (wasReacting ? c + 1 : Math.max(0, c - 1)));
        return;
      }
      setCount(res.helpfulCount);
      setReacting(res.reacting);
    });
  };

  const label = signedIn ? "Mark as helpful" : "Sign in to react";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!signedIn || pending}
      aria-pressed={reacting}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
        reacting
          ? "border-emerald/60 bg-emerald/15 text-emerald"
          : "border-brass/40 text-ink-soft hover:bg-brass/15 hover:text-ink"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span aria-hidden>👍</span>
      <span>{count > 0 ? count : "Helpful"}</span>
    </button>
  );
}
