"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-20">
      <div className="card-brass max-w-lg rounded p-8 text-center">
        <div className="font-display text-5xl text-blood">A spell misfired</div>
        <p className="mt-4 text-ink-soft">
          Something went wrong rendering this page. The team has been notified
          (well, Pablo has, in his console).
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink-soft/70">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="btn-brass mt-6 rounded px-4 py-2 text-sm font-display"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
