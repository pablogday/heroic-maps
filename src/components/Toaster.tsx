"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, toast as toastStore, type Toast } from "@/lib/toast";

/**
 * Site-wide toast renderer. Drop one in the root layout; call
 * `toast.success(...)` / `toast.error(...)` / `toast.info(...)` from any
 * client code to surface feedback. Stacks bottom-right on desktop,
 * full-width-pinned at top on mobile (under the header).
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[76px] z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const palette =
    toast.kind === "success"
      ? "border-emerald/60 bg-emerald/15 text-ink"
      : toast.kind === "error"
        ? "border-blood/60 bg-blood/15 text-blood"
        : "border-brass/60 bg-parchment text-ink";

  return (
    <div
      className={`pointer-events-auto card-brass flex w-full max-w-sm items-start gap-2 rounded border p-3 text-sm shadow-lg ${palette}`}
    >
      <span aria-hidden className="mt-0.5">
        {toast.kind === "success" ? "✓" : toast.kind === "error" ? "⚠" : "ℹ"}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toastStore.dismiss(toast.id)}
        className="ml-1 -mr-1 -mt-1 px-1 text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
