"use client";

import { useTransition } from "react";
import { adminSoftDeleteReview } from "@/app/actions/moderation";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/toast";

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

  const onClick = async () => {
    const ok = await confirmDialog({
      title: "Remove this review?",
      body: "The author will see a 'removed by moderator' notice in place of the form.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await adminSoftDeleteReview({ reviewId, slug });
      if (res.ok) toast.info("Review hidden by moderation.");
      else toast.error(res.error);
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
