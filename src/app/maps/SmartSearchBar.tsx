"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { smartSearch } from "@/app/actions/search";

const EXAMPLES = [
  "small two-player Necropolis map",
  "expert WoG with no underground",
  "biggest HotA maps",
  "newest 4-player maps",
];

export function SmartSearchBar({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await smartSearch(q);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.queryString ? `/maps?${res.queryString}` : "/maps");
    });
  };

  return (
    <div
      className={`card-brass mb-3 rounded p-4 transition-opacity ${
        pending ? "opacity-90" : ""
      }`}
    >
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <div className="relative flex flex-1 items-center gap-2 min-w-[260px]">
          <span
            className={`text-brass ${pending ? "animate-pulse" : ""}`}
            aria-hidden
          >
            ✨
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Describe the map you want…"
            maxLength={300}
            disabled={pending}
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brass focus:outline-none disabled:opacity-70"
            aria-label="Smart search — describe the map in plain English"
            aria-busy={pending}
          />
          {pending && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-brass border-t-transparent"
              aria-hidden
            />
          )}
        </div>
        <button
          type="submit"
          disabled={pending || !q.trim()}
          className="btn-brass relative rounded px-4 py-2 text-sm font-display disabled:opacity-50"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-ink/40 border-t-ink"
                aria-hidden
              />
              Thinking…
            </span>
          ) : (
            "Smart search"
          )}
        </button>
      </form>
      {pending ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
          <span className="inline-flex gap-0.5">
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-brass [animation-delay:-0.3s]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-brass [animation-delay:-0.15s]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-brass" />
          </span>
          Reading your query and picking filters…
        </p>
      ) : error ? (
        <p className="mt-2 text-xs text-blood">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">
          Try:{" "}
          {EXAMPLES.map((ex, i) => (
            <span key={ex}>
              <button
                type="button"
                onClick={() => setQ(ex)}
                className="italic underline-offset-2 hover:underline hover:text-ink"
              >
                {ex}
              </button>
              {i < EXAMPLES.length - 1 && " · "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
