/**
 * Usernames the app's top-level routes own. Anything appearing here
 * cannot be claimed as a user handle so `/[username]` doesn't collide
 * with first-class pages.
 *
 * Includes existing routes plus common system / admin / future-feature
 * names so we don't paint ourselves into a corner. Lowercase only.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Existing routes
  "maps",
  "library",
  "feed",
  "stats",
  "upload",
  "series",
  "api",
  "auth",
  // Implicit Next.js / asset paths
  "_next",
  "favicon",
  "favicon.ico",
  "icon",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  "opengraph-image",
  "manifest",
  "manifest.json",
  // Likely-future features (cheap insurance)
  "settings",
  "profile",
  "u",
  "user",
  "users",
  "search",
  "browse",
  "discover",
  "explore",
  "trending",
  "new",
  "popular",
  "random",
  "tags",
  "factions",
  "campaigns",
  "uploads",
  "admin",
  "moderator",
  "mod",
  "support",
  "help",
  "about",
  "faq",
  "terms",
  "privacy",
  "legal",
  "contact",
  "login",
  "logout",
  "signin",
  "signout",
  "signup",
  "register",
  "account",
  "billing",
  "subscribe",
  "embed",
  "oembed",
  "widget",
  "widgets",
  "rss",
  "atom",
  "feeds",
  "system",
  "static",
  "assets",
  "public",
  "cdn",
  "media",
  "img",
  "images",
  "css",
  "js",
  "fonts",
  "downloads",
  "download",
  // Reserved sentinels
  "anonymous",
  "deleted",
  "null",
  "undefined",
  "me",
  "self",
  "home",
  "index",
  "default",
]);

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{0,28}[a-z0-9])?$/;

export function isValidUsername(s: string): boolean {
  if (s.length < 2 || s.length > 30) return false;
  if (!USERNAME_RE.test(s)) return false;
  if (RESERVED_USERNAMES.has(s)) return false;
  return true;
}

export function slugifyForUsername(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 30);
}
