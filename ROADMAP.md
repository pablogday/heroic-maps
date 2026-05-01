# Heroic Maps — Roadmap

Living document. Update as items ship, get descoped, or new ideas land.
Live site: https://heroic-maps.vercel.app

## In progress

_(nothing active)_

## Up next (big rocks)

- [ ] **#8 `.h3m` parser** — Standalone parser sub-project at `src/lib/h3m/`. Auto-fill upload form, backfill empty `victory_condition` / `loss_condition` for 2,958 scraped maps. Designed to be extractable to its own npm package later.
  - [x] **v0.1** — SoD/AB/RoE basic header (size, name, description, difficulty); test scaffolding; coverage script
  - [x] **v0.2** — player blocks (counts, AI/human flags); win/loss conditions
  - [x] **v0.5** — universal (Node + browser) parser; auto-fill on file select in `/upload`, including factions from allowedFactions bitmask
  - [ ] **v0.6** — backfill script: write parsed win/loss conditions into the DB **(active)**
  - [ ] **v0.3** — HotA family. **Status:** prefix between version magic and basic header varies per map (10–29 bytes observed across sample), conditional on a `subRevision` field. Reverse-engineering from bytes alone is risky; needs proper reference docs (HotA team source or community spec) before we ship code. Debug tool ready at `npm run h3m:debug -- <slug-or-id>`.
  - [ ] **v0.4** — WoG, Chronicles
  - [ ] **rar support** — adds `node-unrar-js` (WASM) to rescue ~14% of unparsed files
  - [ ] **investigate magic 0x06 / 0x0a** — 91 mystery files (some may be wrong-game uploads)
  - [ ] **v1.0** — minimap rendering from terrain (tile palette, sprite atlas — separate effort)
  - **Discipline:** every version bump must run `npm run h3m:coverage` and not regress the previous version's parse-success rate without a deliberate reason.
- [ ] **#6 AI series detection pass** — Long tail the heuristic missed (~95% of maps still untagged for series).
- [ ] **#16 Public API + RSS feed** — `/api/v1/maps`, `/api/v1/maps/{slug}`, `/api/v1/maps/{slug}/reviews`, `/api/v1/factions/{name}`, `/feed.rss`, `/feed.atom`. Same repo, versioned, rate-limited (Upstash or Vercel edge), CDN-cached, documented at `/api`. (~2 days max)
- [ ] **#9 Public user profiles** `/u/[username]` — their reviews, favorites, played stats. (~1.5 hr)

## Going live

- [ ] Buy `heroicmaps.app` from Porkbun (~$15)
- [ ] Wire DNS + custom domain in Vercel (30 min)
- [ ] Update `NEXT_PUBLIC_SITE_URL` + Discord OAuth callback for prod (5 min)
- [ ] Custom R2 subdomain `media.heroicmaps.app` (30 min, after domain)
- [ ] Vercel Analytics or PostHog (15 min)
- [ ] Sentry for prod errors (15 min)

## Polish & nice-to-haves

- [ ] Smart search (Claude NL → SQL): "small map for 2 players, no underground" → SQL filter (~2 hr)
- [ ] "Tell me about this map" chat — Q&A on detail pages grounded in description + reviews (~2 hr)
- [ ] Playstyle filter (story / playable / sandbox / unknown) — heuristic now (30 min) → AI refine later
- [ ] Per-map JSON-LD for SEO (30 min)
- [ ] Rate-limit review submissions (one per minute per user, 30 min)
- [ ] Light moderation: soft-delete reviews, report button, simple admin allow-list (~2 hr)
- [ ] Better empty states for `/feed`, `/library`, `/stats` matching `/maps` parchment loader (30 min)
- [ ] Reviewer leaderboard on `/stats` (top 10 reviewers this month, 30 min)
- [ ] Review reactions (👍 / "this helped", 1 hr)
- [ ] Themed confirm-delete modal instead of native `confirm()` (45 min)
- [ ] Skeleton placeholders inside homepage activity strip (20 min)
- [ ] Sort options inside `/library` tabs (recent / oldest / by name, 30 min)
- [ ] Author field — scrape and display author names properly (1 hr)
- [ ] Map preview lightbox — click minimap → fullscreen viewer with zoom + pan + surface/underground toggle
- [ ] Diff view between map versions (when uploaders revise a map)
- [ ] Embed widget — `<iframe src="/embed/maps/slug">` for Discord servers / blogs
- [ ] Comments thread under reviews (small, no nesting)
- [ ] Share-a-screenshot — let users attach in-game screenshots to reviews
- [ ] Random map button — `/maps/random` redirects to a weighted-random map (~10 lines)

## Open UX items (flagged, not re-confirmed)

- [ ] Mobile nav ghost band post-redeploy — verify on phone
- [ ] Mobile difficulty tile end-to-end (desktop + mobile)
- [ ] Broader use of toast system across error/success flows beyond sign-in/out

## Trust & ops

- [ ] GitHub Support email about purging orphan commit `87144b8` (low priority — `backups/` was committed to public repo for ~30 sec)
- [ ] Confirm Neon PITR retention window in Neon UI (Settings → Restore)
- [ ] Possibly weekly `pg_dump` to R2

## Killed / parked permanently

- Sound toggle
- Thumbnail AI upscaling (cheap pixel-doubling already covers it)
- Splitting data layer into a separate service (keep public API in same Next.js repo)

## Shipped

- **#7 Real upload** — `/upload` accepts `.h3m`/`.h3c`/`.zip` (≤8 MB), validates metadata, uploads to R2 at `maps/uploaded/<slug>.<ext>`, writes `maps` row tied to `uploaderId`, redirects to detail page. 5 uploads/day per user. Manual metadata entry for now (auto-fill comes with #8).
- Scaffold + retro-modern theme + landing page
- Drizzle ORM, Neon Postgres, full migration discipline (baseline, snapshot/restore scripts, `db:snapshot`/`db:restore`)
- Scraper: 2,966 maps with previews, descriptions, source rating
- `/maps` browse: grid + list, filters (version/size/players/difficulty/faction/sort), pagination
- Map detail page: surface/underground side-by-side, MapStats sidebar, StatIcons, Towns block with crests
- Reviews end-to-end: server actions, ReviewForm, transactional aggregate recompute
- Auth.js + Discord login
- Pixel-doubled thumbnails, themed map preview placeholder (brass shield + parchment shimmer)
- AI review summary script + `/api/cron/summarize` + Vercel daily cron at 4 AM UTC
- Faction crests: component, filter strip, sidebar, card badges, heuristic backfill, AI tagging pass (47.1% coverage, $2.15 spent)
- Sword cursor on clickables; once-per-session boot splash
- "Maps like this" (3 randomized similar)
- `/stats`: size×players heatmap, version bars, faction bars
- `/feed` (homepage strip + timeline)
- `/library`: favorites, bookmarks, "I played this"
- Unified `<MapCard>` everywhere; `<BookmarkButton>` on cards; surface/underground toggle
- Slimmed header + UserMenu dropdown; merged mobile hamburger+avatar; full-width drawer
- Site-wide toast system (`lib/toast.ts` + `<Toaster>`)
- Staggered card-rise animation across grids
- Difficulty filter; stacked DifficultyTile; fixed-width thumbnail toggle
- SiteFooter, favicon, OG (static + per-map dynamic via `next/og`), sitemap, robots, not-found, error boundaries
- Loading skeletons with animated parchment loader (min 500ms), `<PageReveal>` fade transitions
- Cloudflare R2: 2,965 surface previews + 2,953 underground + 2,958 `.h3m` files migrated; `lib/r2.ts`
- DB-backed lookup tables (`map_versions`, `map_sizes`, `difficulty_levels`) + `lib/meta.ts` cache + `check:meta` drift detector
- Map series: `map_series` table + heuristic detector (130 maps → 52 series); `<SeriesBlock>` on detail; `/series/[slug]`
- Deployed: https://heroic-maps.vercel.app
- All hygiene rotations done (Discord secret, Neon password, AUTH_SECRET, Anthropic key, R2 key)
