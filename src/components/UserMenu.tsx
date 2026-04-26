"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";

/**
 * Click-to-open dropdown attached to the user avatar in the site header.
 * Holds the user-only nav links (Library, Upload) and Sign Out.
 */
export function UserMenu({
  name,
  image,
}: {
  name: string | null | undefined;
  image: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape.
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
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-brass/40 bg-night-deep/40 py-1 pl-1 pr-2 text-sm text-parchment hover:border-brass-bright"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "Profile"}
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded-full"
            unoptimized
          />
        ) : (
          <div className="h-[26px] w-[26px] rounded-full bg-brass/30" />
        )}
        <span className="hidden sm:inline">{name ?? "Account"}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          aria-hidden
          className={`text-parchment/70 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="card-brass absolute right-0 top-full z-50 mt-2 w-44 rounded p-1 shadow-lg"
        >
          <MenuLink href="/library" emoji="♥" onClick={() => setOpen(false)}>
            Library
          </MenuLink>
          <MenuLink href="/upload" emoji="↑" onClick={() => setOpen(false)}>
            Upload a map
          </MenuLink>
          <div className="my-1 h-px bg-brass/30" />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-blood hover:bg-blood/10"
            >
              <span className="w-3 text-center" aria-hidden>
                ⎋
              </span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  emoji,
  onClick,
  children,
}: {
  href: string;
  emoji: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 rounded px-3 py-2 text-sm text-ink hover:bg-brass/20"
    >
      <span className="w-3 text-center" aria-hidden>
        {emoji}
      </span>
      {children}
    </Link>
  );
}
