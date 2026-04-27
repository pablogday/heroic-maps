"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signInDiscord, signOutAction } from "@/app/actions/auth";
import { PUBLIC_LINKS, USER_LINKS, type NavLink } from "./nav-data";
import { IconHamburger, IconSignOut } from "./nav-icons";

/**
 * Mobile-only merged menu. Single bordered button in the header — when
 * signed in, shows the avatar plus a hamburger glyph (one touch target);
 * when signed out, just the hamburger. Tapping opens a full-width drawer
 * sliding down from below the header with all nav links plus auth
 * actions, using the same icon set as the desktop dropdown.
 */
export function MobileNav({
  user,
}: {
  user: { name: string | null | undefined; image: string | null | undefined } | null;
}) {
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

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded border border-brass/40 bg-night-deep/40 py-1 pl-1 pr-2 text-parchment hover:border-brass-bright md:hidden"
      >
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Profile"}
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded-full"
            unoptimized
          />
        ) : null}
        <span className="text-parchment/90">
          <IconHamburger />
        </span>
      </button>

      {/* Backdrop covers the page below the header so the header stays
          tappable (the merged button doubles as the drawer close). */}
      <div
        onClick={close}
        className={`fixed inset-x-0 bottom-0 top-[64px] z-40 bg-night-deep/60 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Drawer — anchored at top:0, slid down to header height when open */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!open}
        className={`fixed inset-x-0 top-0 z-50 border-b border-brass/40 bg-parchment shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open
            ? "translate-y-[64px]"
            : "pointer-events-none -translate-y-full"
        }`}
      >
        <nav className="mx-auto max-w-6xl px-4 py-3">
          <ul className="flex flex-col">
            {PUBLIC_LINKS.map((link) => (
              <DrawerItem key={link.href} link={link} onClick={close} />
            ))}

            {user ? (
              <>
                <Separator />
                {USER_LINKS.map((link) => (
                  <DrawerItem key={link.href} link={link} onClick={close} />
                ))}
                <li>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-base font-display text-blood hover:bg-blood/10"
                    >
                      <span>
                        <IconSignOut />
                      </span>
                      Sign out
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <Separator />
                <li>
                  <form action={signInDiscord}>
                    <button
                      type="submit"
                      className="btn-brass mt-1 w-full rounded px-4 py-2.5 text-sm font-display"
                      onClick={close}
                    >
                      Sign in with Discord
                    </button>
                  </form>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </>
  );
}

function DrawerItem({
  link,
  onClick,
}: {
  link: NavLink;
  onClick: () => void;
}) {
  const { href, label, Icon } = link;
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-3 rounded px-3 py-3 text-base font-display text-ink hover:bg-brass/15"
      >
        <span className="text-brass" aria-hidden>
          <Icon />
        </span>
        {label}
      </Link>
    </li>
  );
}

function Separator() {
  return <li aria-hidden className="my-2 h-px bg-brass/30" />;
}
