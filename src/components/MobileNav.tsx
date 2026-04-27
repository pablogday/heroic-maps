"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";
import { toast } from "@/lib/toast";
import { PUBLIC_LINKS, USER_LINKS, type NavLink } from "./nav-data";
import { IconHamburger, IconSignOut } from "./nav-icons";

/**
 * Mobile-only merged menu. Single bordered button — when signed in shows
 * avatar + hamburger glyph (one touch target); when signed out, a pill
 * with hamburger + "Menu" label. Tapping opens a full-width drawer
 * sliding down from below the header.
 */
export function MobileNav({
  user,
}: {
  user: { name: string | null | undefined; image: string | null | undefined } | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Lock body scroll while open + close on Escape.
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

  const onSignOut = () => {
    setOpen(false);
    toast.info("Signing out…");
    startTransition(() => {
      signOut({ callbackUrl: "/" });
    });
  };

  const onSignIn = () => {
    setOpen(false);
    toast.info("Redirecting to Discord…");
    signIn("discord");
  };

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
        ) : (
          // Signed-out: small "MENU" label so the button doesn't feel
          // dwarfed compared to the avatar variant.
          <span className="px-1 font-display text-[11px] uppercase tracking-[0.2em] text-parchment/85">
            Menu
          </span>
        )}
        <span className="text-parchment/90">
          <IconHamburger />
        </span>
      </button>

      {/* Backdrop — only below the header so the menu button stays bright.
          backdrop-blur applied conditionally; iOS Safari sometimes renders
          the blur even at opacity:0, which produced a faint haze under the
          header when the menu was closed. */}
      <div
        onClick={close}
        className={`fixed inset-x-0 bottom-0 top-[64px] z-30 bg-night-deep/60 transition-opacity md:hidden ${
          open
            ? "opacity-100 backdrop-blur-sm"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Clip container starts at the header bottom and hides anything
          translating above. The inner drawer can slide freely without
          ever flashing over the header during the transition. */}
      <div
        aria-hidden={!open}
        className="pointer-events-none fixed inset-x-0 bottom-0 top-[64px] z-40 overflow-hidden md:hidden"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={`pointer-events-auto border-b border-brass/40 bg-parchment transition-transform duration-300 ease-out ${
            open
              ? "translate-y-0 shadow-xl"
              : "-translate-y-full"
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
                    <button
                      type="button"
                      onClick={onSignOut}
                      disabled={pending}
                      className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-base font-display text-blood hover:bg-blood/10 disabled:opacity-60"
                    >
                      <span>
                        <IconSignOut />
                      </span>
                      {pending ? "Signing out…" : "Sign out"}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <Separator />
                  <li>
                    <button
                      type="button"
                      onClick={onSignIn}
                      className="btn-brass mt-1 w-full rounded px-4 py-2.5 text-sm font-display"
                    >
                      Sign in with Discord
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
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
