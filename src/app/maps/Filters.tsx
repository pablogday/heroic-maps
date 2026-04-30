"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  SIZES,
  SIZE_LABEL,
  SORT_OPTIONS,
  VERSION_LABEL,
  VERSIONS,
} from "@/lib/map-constants";
import { FACTIONS, FACTION_LABEL, type Faction } from "@/lib/factions";
import { FactionCrest } from "@/components/FactionCrest";

const DEBOUNCE_MS = 250;

export function Filters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    // Any filter change resets pagination
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  // Debounced search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) apply({ q });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Keep input in sync if URL changes externally (e.g., back button)
  useEffect(() => {
    const urlQ = sp.get("q") ?? "";
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  return (
    <div className="card-brass mb-6 flex flex-wrap items-center gap-3 rounded p-4">
      <div className="relative min-w-[200px] flex-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brass focus:outline-none"
          aria-label="Search maps by name"
        />
        {isPending && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border-2 border-brass border-t-transparent"
            aria-hidden
          />
        )}
      </div>

      <select
        value={sp.get("version") ?? ""}
        onChange={(e) => apply({ version: e.target.value })}
        className="rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
        aria-label="Filter by version"
      >
        <option value="">All versions</option>
        {VERSIONS.map((v) => (
          <option key={v} value={v}>
            {VERSION_LABEL[v]}
          </option>
        ))}
      </select>

      <select
        value={sp.get("size") ?? ""}
        onChange={(e) => apply({ size: e.target.value })}
        className="rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
        aria-label="Filter by size"
      >
        <option value="">All sizes</option>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {SIZE_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        value={sp.get("difficulty") ?? ""}
        onChange={(e) => apply({ difficulty: e.target.value })}
        className="rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
        aria-label="Filter by difficulty"
      >
        <option value="">All difficulties</option>
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>
            {DIFFICULTY_LABEL[d]}
          </option>
        ))}
      </select>

      <select
        value={sp.get("sort") ?? "downloads"}
        onChange={(e) =>
          apply({ sort: e.target.value === "downloads" ? "" : e.target.value })
        }
        className="rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
        aria-label="Sort"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <ViewToggle
        current={sp.get("view") === "list" ? "list" : "grid"}
        apply={apply}
      />

      <FactionStrip
        active={(sp.get("faction") as Faction | null) ?? null}
        apply={apply}
      />
    </div>
  );
}

function FactionStrip({
  active,
  apply,
}: {
  active: Faction | null;
  apply: (next: Record<string, string>) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-brass/30 pt-3">
      <span className="mr-1 text-xs uppercase tracking-wider text-ink-soft">
        Faction
      </span>
      {FACTIONS.map((f) => {
        const isActive = active === f;
        return (
          <button
            key={f}
            type="button"
            title={FACTION_LABEL[f]}
            aria-pressed={isActive}
            onClick={() => apply({ faction: isActive ? "" : f })}
            className={`rounded p-0.5 transition-all ${
              isActive
                ? "ring-2 ring-brass-bright scale-110"
                : "opacity-70 hover:opacity-100 hover:scale-105"
            }`}
          >
            <FactionCrest faction={f} size={26} />
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => apply({ faction: "" })}
          className="ml-2 text-xs text-blood hover:underline"
        >
          clear
        </button>
      )}
    </div>
  );
}

function ViewToggle({
  current,
  apply,
}: {
  current: "grid" | "list";
  apply: (next: Record<string, string>) => void;
}) {
  const base =
    "flex h-9 w-9 items-center justify-center border border-brass/50 transition-colors";
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex overflow-hidden rounded"
    >
      <button
        type="button"
        aria-pressed={current === "grid"}
        title="Grid view"
        onClick={() => apply({ view: "" })}
        className={`${base} rounded-l ${
          current === "grid"
            ? "bg-brass/40 text-ink"
            : "bg-parchment text-ink-soft hover:bg-brass/15"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        aria-pressed={current === "list"}
        title="List view"
        onClick={() => apply({ view: "list" })}
        className={`${base} -ml-px rounded-r ${
          current === "list"
            ? "bg-brass/40 text-ink"
            : "bg-parchment text-ink-soft hover:bg-brass/15"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <rect x="1" y="2" width="14" height="2" rx="1" />
          <rect x="1" y="7" width="14" height="2" rx="1" />
          <rect x="1" y="12" width="14" height="2" rx="1" />
        </svg>
      </button>
    </div>
  );
}
