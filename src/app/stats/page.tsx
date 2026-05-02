import Link from "next/link";
import Image from "next/image";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { maps, reviews, users } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { FactionCrest } from "@/components/FactionCrest";
import { SIZES, SIZE_LABEL, VERSION_LABEL, VERSIONS } from "@/lib/map-constants";
import { FACTIONS, FACTION_LABEL, type Faction } from "@/lib/factions";

export const metadata = {
  title: "Stats — Heroic Maps",
  description: "The shape of the HoMM3 mapmaking community.",
};

const PLAYER_BUCKETS = [2, 3, 4, 5, 6, 7, 8] as const;

export default async function StatsPage() {
  // Headline numbers — single round-trip via UNION ALL would be tidier,
  // but Neon is fast and the parallel reads stay sub-100ms total.
  const [headline, sizePlayer, byVersion, byFaction] = await Promise.all([
    db
      .select({
        totalMaps: sql<number>`count(*)::int`,
        totalDownloads: sql<number>`coalesce(sum(${maps.downloadCount}), 0)::bigint`,
        withUnderground: sql<number>`sum(case when ${maps.hasUnderground} then 1 else 0 end)::int`,
        avgPlayers: sql<number>`avg(${maps.totalPlayers})::float`,
      })
      .from(maps),
    db
      .select({
        size: maps.size,
        players: maps.totalPlayers,
        n: sql<number>`count(*)::int`,
      })
      .from(maps)
      .groupBy(maps.size, maps.totalPlayers),
    db
      .select({
        version: maps.version,
        n: sql<number>`count(*)::int`,
      })
      .from(maps)
      .groupBy(maps.version),
    db
      .select({
        faction: sql<string>`unnest(${maps.factions})`.as("faction"),
        n: sql<number>`count(*)::int`,
      })
      .from(maps)
      .where(sql`${maps.factions} IS NOT NULL`)
      .groupBy(sql`faction`),
  ]);

  // Total reviews — separate because it hits a different table.
  const [reviewAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews);

  // Top reviewers in the last 30 days by review count, with avg rating
  // they handed out as a tie-breaker / context.
  const topReviewers = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      avatar: users.avatarUrl,
      image: users.image,
      reviewCount: sql<number>`count(${reviews.id})::int`,
      avgRating: sql<number>`avg(${reviews.rating})::float`,
    })
    .from(reviews)
    .innerJoin(users, sql`${users.id} = ${reviews.userId}`)
    .where(sql`${reviews.createdAt} > now() - interval '30 days'`)
    .groupBy(users.id, users.username, users.name, users.avatarUrl, users.image)
    .orderBy(sql`count(${reviews.id}) desc`)
    .limit(10);

  const h = headline[0];

  // Pre-bucket size×players counts for the heatmap.
  const grid = new Map<string, number>();
  let maxCell = 0;
  for (const row of sizePlayer) {
    const players = Math.max(2, Math.min(8, row.players));
    const key = `${row.size}|${players}`;
    const next = (grid.get(key) ?? 0) + row.n;
    grid.set(key, next);
    if (next > maxCell) maxCell = next;
  }

  // Per-version sort to roughly match the legacy scene's chronology.
  const versionCounts = Object.fromEntries(byVersion.map((v) => [v.version, v.n]));
  const maxVersion = Math.max(1, ...byVersion.map((v) => v.n));

  // Faction counts as a Record for quick lookup.
  const factionCounts = Object.fromEntries(byFaction.map((f) => [f.faction, f.n]));
  const maxFaction = Math.max(1, ...byFaction.map((f) => f.n));

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
       <PageReveal>
        <div className="mb-8">
          <h1 className="font-display text-4xl text-ink">The Realm in Numbers</h1>
          <p className="mt-2 text-ink-soft">
            Aggregate stats across every map in the archive.
          </p>
        </div>

        {/* Headline tiles */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Headline label="Maps catalogued" value={h.totalMaps.toLocaleString()} />
          <Headline
            label="Total downloads"
            value={Number(h.totalDownloads).toLocaleString()}
          />
          <Headline label="Player reviews" value={reviewAgg.n.toLocaleString()} />
          <Headline
            label="With underground"
            value={`${Math.round((h.withUnderground / h.totalMaps) * 100)}%`}
          />
        </div>

        {/* Heatmap */}
        <section className="card-brass mb-10 rounded p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Size × Players</h2>
            <span className="text-xs text-ink-soft">
              Cells = number of maps · darker = more
            </span>
          </div>
          <Heatmap grid={grid} maxCell={maxCell} />
        </section>

        {/* Versions */}
        <section className="card-brass mb-10 rounded p-6">
          <h2 className="mb-4 font-display text-xl text-ink">By version</h2>
          <ul className="space-y-2">
            {VERSIONS.map((v) => {
              const n = versionCounts[v] ?? 0;
              const pct = Math.round((n / maxVersion) * 100);
              return (
                <li key={v} className="flex items-center gap-3 text-sm">
                  <Link
                    href={`/maps?version=${v}`}
                    title={v}
                    className="w-44 shrink-0 truncate text-ink hover:text-blood"
                  >
                    {VERSION_LABEL[v]}
                  </Link>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-night-deep/15">
                    <div
                      className="h-full bg-gradient-to-r from-brass to-brass-bright"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-ink-soft">
                    {n.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Factions */}
        <section className="card-brass mb-10 rounded p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">By faction</h2>
            <span className="text-xs text-ink-soft">
              Inferred from map descriptions — best-effort
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FACTIONS.map((f) => {
              const n = factionCounts[f] ?? 0;
              const pct = Math.round((n / maxFaction) * 100);
              return (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <Link
                    href={`/maps?faction=${f}`}
                    className="flex items-center gap-2"
                    title={`Browse ${FACTION_LABEL[f as Faction]} maps`}
                  >
                    <FactionCrest faction={f as Faction} size={26} />
                  </Link>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink">{FACTION_LABEL[f as Faction]}</span>
                      <span className="text-ink-soft tabular-nums">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-night-deep/15">
                      <div
                        className="h-full bg-gradient-to-r from-brass to-brass-bright"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {topReviewers.length > 0 && (
          <section className="card-brass mb-10 rounded p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">
                Reviewer leaderboard
              </h2>
              <span className="text-xs text-ink-soft">
                Most reviews in the last 30 days
              </span>
            </div>
            <ol className="space-y-2">
              {topReviewers.map((r, i) => {
                const display = r.name ?? r.username ?? "Anonymous";
                const avatar = r.avatar ?? r.image;
                const medal =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                const inner = (
                  <div className="flex items-center gap-3 rounded p-2 hover:bg-brass/10">
                    <div className="w-6 text-center font-display text-sm text-ink-soft">
                      {medal ?? `#${i + 1}`}
                    </div>
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full border border-brass/40"
                        unoptimized
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-brass/30" />
                    )}
                    <span className="flex-1 text-sm font-medium text-ink">
                      {display}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {r.reviewCount} review{r.reviewCount === 1 ? "" : "s"} ·
                      avg {r.avgRating.toFixed(1)}★
                    </span>
                  </div>
                );
                return (
                  <li key={r.userId}>
                    {r.username ? (
                      <Link href={`/${r.username}`} className="block">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <p className="text-center text-xs text-ink-soft">
          Average map: {h.avgPlayers.toFixed(1)} players · numbers refresh on
          every visit.
        </p>
       </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-brass rounded p-5 text-center">
      <div className="font-display text-3xl text-ink">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink-soft">
        {label}
      </div>
    </div>
  );
}

function Heatmap({
  grid,
  maxCell,
}: {
  grid: Map<string, number>;
  maxCell: number;
}) {
  // Brass-themed intensity: 0 → faded parchment; max → deep brass.
  const cellColor = (n: number) => {
    if (n === 0) return "rgba(184, 138, 58, 0.06)";
    const t = Math.pow(n / maxCell, 0.6); // gamma-bend so small values still register
    const r = Math.round(239 - (239 - 184) * t);
    const g = Math.round(226 - (226 - 138) * t);
    const b = Math.round(195 - (195 - 58) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header row: player counts */}
        <div className="grid grid-cols-[80px_repeat(7,minmax(60px,1fr))] gap-1">
          <div />
          {PLAYER_BUCKETS.map((p) => (
            <div
              key={p}
              className="text-center text-xs uppercase tracking-wider text-ink-soft"
            >
              {p}P
            </div>
          ))}
          {SIZES.map((s) => (
            <Row key={s}>
              <div className="text-right text-xs text-ink-soft pr-1">
                {SIZE_LABEL[s]}
              </div>
              {PLAYER_BUCKETS.map((p) => {
                const n = grid.get(`${s}|${p}`) ?? 0;
                return (
                  <Link
                    key={`${s}-${p}`}
                    href={`/maps?size=${s}&players=${p}`}
                    className="group relative flex aspect-square items-center justify-center rounded text-xs font-medium text-ink transition-transform hover:scale-105 hover:ring-2 hover:ring-brass-bright"
                    style={{ backgroundColor: cellColor(n) }}
                    title={`${SIZE_LABEL[s]} · ${p} players · ${n} maps`}
                  >
                    {n > 0 ? n : ""}
                  </Link>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
