"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  {
    href: "/maps",
    label: "Browse",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
        <rect x="2" y="2" width="6" height="6" rx="1" />
        <rect x="10" y="2" width="6" height="6" rx="1" />
        <rect x="2" y="10" width="6" height="6" rx="1" />
        <rect x="10" y="10" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    href: "/feed",
    label: "Feed",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
        <circle cx="3.5" cy="14.5" r="1.5" />
        <path d="M2 8 a8 8 0 0 1 8 8 h-2 a6 6 0 0 0 -6 -6 z" />
        <path d="M2 3 a13 13 0 0 1 13 13 h-2 a11 11 0 0 0 -11 -11 z" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
        <rect x="2" y="10" width="3" height="6" rx="0.5" />
        <rect x="7.5" y="6" width="3" height="10" rx="0.5" />
        <rect x="13" y="2" width="3" height="14" rx="0.5" />
      </svg>
    ),
  },
] as const;

/**
 * Mobile-only nav. Hamburger in the header opens a full-width drawer
 * sliding down from the top with the main nav links + a backdrop blur.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-brass/40 bg-night-deep/40 text-parchment hover:border-brass-bright md:hidden"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          <g
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className={`origin-center transition-transform ${
              open ? "[&>path:first-child]:translate-y-[5px] [&>path:first-child]:rotate-45 [&>path:last-child]:-translate-y-[5px] [&>path:last-child]:-rotate-45 [&>path:nth-child(2)]:opacity-0" : ""
            }`}
          >
            <path d="M2 2 L16 2" className="transition-[transform,opacity]" />
            <path d="M2 7 L16 7" className="transition-[transform,opacity]" />
            <path d="M2 12 L16 12" className="transition-[transform,opacity]" />
          </g>
        </svg>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-night-deep/60 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Drawer — anchored to top:0, slid down to header height when open */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={`fixed inset-x-0 top-0 z-50 border-b border-brass/40 bg-parchment shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open
            ? "translate-y-[64px]"
            : "pointer-events-none -translate-y-full"
        }`}
        aria-hidden={!open}
      >
        <nav className="mx-auto max-w-6xl px-4 py-3">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded px-3 py-3 text-base font-display text-ink hover:bg-brass/15"
                >
                  <span className="text-brass" aria-hidden>
                    {l.icon}
                  </span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
