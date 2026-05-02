"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Variant = "danger" | "default";

/**
 * Tiny themed confirm modal. Replaces native confirm() so destructive
 * actions get a proper visual + brand match.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete X?" }))) return;
 *
 * The hook returns a promise<boolean>. The caller awaits the choice
 * and the modal renders via portal.
 */

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let pendingSetter: ((p: PendingConfirm | null) => void) | null = null;

/**
 * Imperative API — call from anywhere. Renders the modal via the
 * <ConfirmHost /> mounted in the layout.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pendingSetter) {
      // Fallback: no host mounted (shouldn't happen in normal app flow)
      resolve(window.confirm(opts.title));
      return;
    }
    pendingSetter({ ...opts, resolve });
  });
}

/**
 * Single host mounted once in the root layout. Holds the open dialog
 * state and registers the imperative setter on mount.
 */
export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [mounted, setMounted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    pendingSetter = setPending;
    return () => {
      pendingSetter = null;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pending.resolve(false);
        setPending(null);
      } else if (e.key === "Enter") {
        pending.resolve(true);
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!mounted || !pending) return null;

  const isDanger = pending.variant === "danger";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-night-deep/70 backdrop-blur-sm"
      onClick={() => {
        pending.resolve(false);
        setPending(null);
      }}
    >
      <div
        className="card-brass mx-4 w-full max-w-sm rounded p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          className="font-display text-lg text-ink"
        >
          {pending.title}
        </h2>
        {pending.body && (
          <p className="mt-2 text-sm text-ink-soft">{pending.body}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              pending.resolve(false);
              setPending(null);
            }}
            className="rounded border border-brass/40 px-3 py-1.5 text-sm text-ink-soft hover:bg-brass/15 hover:text-ink"
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              pending.resolve(true);
              setPending(null);
            }}
            className={`rounded px-4 py-1.5 text-sm font-display ${
              isDanger
                ? "border border-blood/60 bg-blood/15 text-blood hover:bg-blood/25"
                : "btn-brass"
            }`}
          >
            {pending.confirmLabel ?? (isDanger ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
