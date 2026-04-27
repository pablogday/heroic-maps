import {
  IconBrowse,
  IconFeed,
  IconLibrary,
  IconStats,
  IconUpload,
} from "./nav-icons";

export type NavLink = {
  href: string;
  label: string;
  Icon: () => React.ReactElement;
};

/** Always visible links — public, no auth required. */
export const PUBLIC_LINKS: NavLink[] = [
  { href: "/maps", label: "Browse", Icon: IconBrowse },
  { href: "/feed", label: "Feed", Icon: IconFeed },
  { href: "/stats", label: "Stats", Icon: IconStats },
];

/** Logged-in-only links. Sign-out is handled separately because it's a form. */
export const USER_LINKS: NavLink[] = [
  { href: "/library", label: "Library", Icon: IconLibrary },
  { href: "/upload", label: "Upload a map", Icon: IconUpload },
];
