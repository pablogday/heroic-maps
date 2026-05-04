"use client";

import { useTransition } from "react";
import { adminSoftDeleteReview } from "@/app/actions/moderation";

/** Admin-only button next to a review. Soft-deletes via the
 * moderation action; the page revalidates and the row hides. */
export function AdminRemoveReview({
  reviewId,
  slug,
}: {
  reviewId: number;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Remove this review? Author will see a 'removed by moderator' notice."))
      return;
    startTransition(async () => {
      await adminSoftDeleteReview({ reviewId, slug });
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-ink-soft/70 hover:text-blood disabled:opacity-50"
      title="Admin: soft-delete"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
