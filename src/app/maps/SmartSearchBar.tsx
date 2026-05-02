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
    <div className="card-brass mb-3 rounded p-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[260px]">
          <span className="text-brass" aria-hidden>
            ✨
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Describe the map you want…"
            maxLength={300}
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brass focus:outline-none"
            aria-label="Smart search — describe the map in plain English"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !q.trim()}
          className="btn-brass rounded px-4 py-2 text-sm font-display disabled:opacity-50"
        >
          {pending ? "Searching…" : "Smart search"}
        </button>
      </form>
      {error ? (
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
