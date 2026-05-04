"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { createComment, deleteComment } from "@/app/actions/comments";
import { adminSoftDeleteComment } from "@/app/actions/moderation";
import { ReportButton } from "./ReportButton";

interface CommentRow {
  id: number;
  reviewId: number;
  userId: string;
  body: string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
}

/** Flat comment thread under one review. Optimistically appends new
 * comments and removes deleted ones so the form feels responsive
 * without waiting for a server round-trip. */
export function CommentThread({
  reviewId,
  slug,
  initialComments,
  viewerId,
  viewerIsAdmin,
}: {
  reviewId: number;
  slug: string;
  initialComments: CommentRow[];
  viewerId: string | null;
  viewerIsAdmin: boolean;
}) {
  const [items, setItems] = useState<CommentRow[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createComment({ reviewId, body: trimmed, slug });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Best-effort optimistic insert. The real timestamp comes back
      // via the page refresh; until then we use Date.now().
      setItems((prev) => [
        ...prev,
        {
          id: res.data?.id ?? -prev.length - 1,
          reviewId,
          userId: viewerId,
          body: trimmed,
          createdAt: new Date(),
          deletedAt: null,
          authorName: null,
          authorImage: null,
          authorUsername: null,
        },
      ]);
      setBody("");
    });
  };

  const onDelete = (id: number, viaAdmin: boolean) => {
    if (!confirm(viaAdmin ? "Remove this comment?" : "Delete your comment?"))
      return;
    startTransition(async () => {
      const res = viaAdmin
        ? await adminSoftDeleteComment({ commentId: id, slug })
        : await deleteComment({ commentId: id, slug });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // For author hard-delete, drop the row. For admin soft-delete,
      // mark deletedAt so the placeholder renders.
      setItems((prev) =>
        viaAdmin
          ? prev.map((c) =>
              c.id === id ? { ...c, deletedAt: new Date(), body: "" } : c
            )
          : prev.filter((c) => c.id !== id)
      );
    });
  };

  return (
    <div className="mt-3 border-t border-brass/25 pt-3">
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              viewerId={viewerId}
              viewerIsAdmin={viewerIsAdmin}
              slug={slug}
              onDelete={onDelete}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {viewerId ? (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={800}
            className="w-full resize-y rounded border border-brass/40 bg-parchment-dark/30 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brass focus:outline-none"
            disabled={pending}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-soft/60">
              {body.length}/800 · be kind
            </span>
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="rounded border border-brass/50 px-3 py-1 text-xs text-ink transition-colors hover:bg-brass/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Posting…" : "Post comment"}
            </button>
          </div>
          {error && <p className="text-xs text-blood">{error}</p>}
        </form>
      ) : (
        items.length === 0 && (
          <p className="text-xs italic text-ink-soft/60">
            Sign in to comment.
          </p>
        )
      )}
    </div>
  );
}

function CommentItem({
  c,
  viewerId,
  viewerIsAdmin,
  slug,
  onDelete,
  pending,
}: {
  c: CommentRow;
  viewerId: string | null;
  viewerIsAdmin: boolean;
  slug: string;
  onDelete: (id: number, viaAdmin: boolean) => void;
  pending: boolean;
}) {
  const isOwn = viewerId === c.userId;
  const isDeleted = !!c.deletedAt;

  return (
    <li className="flex items-start gap-2 rounded bg-parchment-dark/20 px-2.5 py-1.5">
      {c.authorImage ? (
        <Image
          src={c.authorImage}
          alt={c.authorName ?? ""}
          width={20}
          height={20}
          unoptimized
          className="mt-0.5 h-5 w-5 flex-none rounded-full"
        />
      ) : (
        <span className="mt-0.5 h-5 w-5 flex-none rounded-full bg-brass/30" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[11px] text-ink-soft">
          {c.authorUsername ? (
            <Link
              href={`/${c.authorUsername}`}
              className="font-display text-ink hover:underline"
            >
              {c.authorName ?? c.authorUsername}
            </Link>
          ) : (
            <span className="font-display text-ink">
              {c.authorName ?? "Player"}
            </span>
          )}
          <time dateTime={new Date(c.createdAt).toISOString()}>
            {timeAgo(new Date(c.createdAt))}
          </time>
        </div>
        {isDeleted ? (
          <p className="mt-0.5 text-sm italic text-ink-soft/60">
            [removed by moderation]
          </p>
        ) : (
          <p className="mt-0.5 whitespace-pre-line text-sm text-ink">
            {c.body}
          </p>
        )}
      </div>
      {!isDeleted && (
        <div className="mt-0.5 flex flex-none items-center gap-1.5 text-[11px]">
          {viewerId && !isOwn && (
            <ReportButton
              targetType="comment"
              targetId={c.id}
              slug={slug}
              compact
            />
          )}
          {(isOwn || viewerIsAdmin) && (
            <button
              type="button"
              onClick={() => onDelete(c.id, !isOwn && viewerIsAdmin)}
              disabled={pending}
              className="text-ink-soft/70 hover:text-blood disabled:opacity-50"
              title={isOwn ? "Delete your comment" : "Remove (admin)"}
            >
              ×
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}
