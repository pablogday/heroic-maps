"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "hm-splashed";
const HOLD_MS = 1300;
const FADE_MS = 600;

/**
 * Once-per-session HoMM3-style boot splash. The companion inline `<head>`
 * snippet (in `app/layout.tsx`) adds `.hm-splash-seen` to <html> when the
 * user has already seen it this session, which CSS uses to hide this
 * component before paint — no flash on subsequent navigations or reloads.
 */
export function BootSplash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        setPhase("gone");
        return;
      }
    } catch {
      /* sessionStorage may be blocked — show the splash anyway. */
    }

    const t1 = setTimeout(() => setPhase("out"), HOLD_MS);
    const t2 = setTimeout(() => {
      setPhase("gone");
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
    }, HOLD_MS + FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`hm-splash fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity ease-out ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        background:
          "radial-gradient(ellipse at center, #1a2342 0%, #0a0e1c 75%)",
      }}
      aria-hidden={phase === "out"}
      role="status"
    >
      <div className="card-brass animate-unfurl rounded px-10 py-8 text-center shadow-[0_0_60px_rgba(184,138,58,0.4)]">
        <div className="mb-3 flex justify-center">
          <CrownTorch />
        </div>
        <h1 className="font-display text-4xl tracking-[0.18em] text-ink">
          HEROIC MAPS
        </h1>
        <p className="mt-2 font-display text-xs uppercase tracking-[0.4em] text-blood">
          A chronicle of Erathia
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.3em] text-ink-soft">
          <span className="h-px w-8 bg-brass/60" />
          <span>Loading the realm</span>
          <span className="h-px w-8 bg-brass/60" />
        </div>
      </div>
    </div>
  );
}

function CrownTorch() {
  return (
    <svg width="56" height="64" viewBox="0 0 56 64" aria-hidden>
      {/* Crown */}
      <g fill="#b88a3a" stroke="#231509" strokeWidth="1" strokeLinejoin="round">
        <path d="M10 28 L14 16 L20 24 L28 12 L36 24 L42 16 L46 28 Z" />
        <rect x="10" y="28" width="36" height="4" />
        <circle cx="28" cy="14" r="2" fill="#8a2222" />
        <circle cx="14" cy="18" r="1.4" fill="#3f8a4f" />
        <circle cx="42" cy="18" r="1.4" fill="#3f8a4f" />
      </g>
      {/* Flame */}
      <g className="animate-flicker" style={{ transformOrigin: "28px 50px" }}>
        <path
          d="M28 36 C 22 44, 24 50, 24 54 C 24 58, 26 60, 28 60 C 30 60, 32 58, 32 54 C 32 50, 34 44, 28 36 Z"
          fill="#e0b656"
        />
        <path
          d="M28 42 C 25 48, 26 52, 28 56 C 30 52, 31 48, 28 42 Z"
          fill="#fff1c4"
        />
      </g>
    </svg>
  );
}
