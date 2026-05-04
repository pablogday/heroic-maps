"use client";

import { useState, useTransition } from "react";
import { reportContent } from "@/app/actions/moderation";
import { toast } from "@/lib/toast";

/** Tiny "report" affordance shown next to a review or comment. Opens
 * an inline reason form on click; submits via server action. The
 * compact variant collapses to a single ⚐ glyph for use inside dense
 * comment rows. */
export function ReportButton({
  targetType,
  targetId,
  slug,
  compact = false,
}: {
  targetType: "review" | "comment";
  targetId: number;
  slug: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Add a short reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await reportContent({
        targetType,
        targetId,
        reason: trimmed,
        slug,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDone(true);
      setOpen(false);
      setReason("");
      toast.success("Reported. Moderators will take a look.");
    });
  };

  if (done) {
    return (
      <span
        className={`text-ink-soft/70 ${compact ? "text-[11px]" : "text-xs"}`}
        title="Thanks — moderators will take a look"
      >
        ✓ reported
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Report"
          className={
            compact
              ? "text-ink-soft/60 hover:text-blood"
              : "text-xs text-ink-soft/70 hover:text-blood"
          }
        >
          {compact ? "⚐" : "Report"}
        </button>
      )}
      {open && (
        <ReportForm
          submit={submit}
          reason={reason}
          setReason={setReason}
          pending={pending}
          error={error}
          onCancel={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
        />
      )}
    </span>
  );
}

function ReportForm({
  submit,
  reason,
  setReason,
  pending,
  error,
  onCancel,
}: {
  submit: (e: React.FormEvent) => void;
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={submit}
      className="absolute right-0 top-full z-10 mt-1 w-64 rounded border border-brass/40 bg-parchment-dark/95 p-2 shadow-lg"
    >
      <label className="block text-[11px] uppercase tracking-wider text-ink-soft">
        Why report?
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={280}
        autoFocus
        placeholder="e.g. spam, harassment, off-topic"
        className="mt-1 w-full resize-y rounded border border-brass/40 bg-parchment px-2 py-1 text-xs text-ink focus:border-brass focus:outline-none"
        disabled={pending}
      />
      {error && <p className="mt-1 text-[11px] text-blood">{error}</p>}
      <div className="mt-1.5 flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-soft hover:text-ink"
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="rounded border border-brass/50 px-2 py-0.5 hover:bg-brass/20 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit"}
        </button>
      </div>
    </form>
  );
}
