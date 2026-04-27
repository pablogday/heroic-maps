"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/maps", label: "Browse" },
  { href: "/feed", label: "Feed" },
  { href: "/stats", label: "Stats" },
] as const;

/**
 * Hamburger menu shown on small screens only. Mirrors the main desktop
 * nav (Browse / Feed / Stats). User-specific links live in `<UserMenu>`,
 * so this component stays simple and identical for signed-in and
 * signed-out users.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-brass/40 bg-night-deep/40 text-parchment hover:border-brass-bright"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          {open ? (
            <path
              d="M2 2 L16 12 M16 2 L2 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : (
            <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2 L16 2" />
              <path d="M2 7 L16 7" />
              <path d="M2 12 L16 12" />
            </g>
          )}
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="card-brass absolute right-0 top-full z-50 mt-2 w-44 rounded p-1 shadow-lg"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-ink hover:bg-brass/20"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
