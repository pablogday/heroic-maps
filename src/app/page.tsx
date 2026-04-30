import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import {
  getFeaturedMaps,
  getRecentlyAdded,
  getRecentlyReviewed,
  VERSIONS,
} from "@/lib/maps";
import { VERSION_LABEL, versionLabel } from "@/lib/map-constants";
import { formatRelativeTime } from "@/lib/relative-time";
import { stagger } from "@/lib/stagger";

export default async function Home() {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const signedIn = viewerId != null;

  const [featured, recentlyAdded, recentlyReviewed] = await Promise.all([
    getFeaturedMaps(3, viewerId),
    getRecentlyAdded(4),
    getRecentlyReviewed(4),
  ]);

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
       <PageReveal>
        <section className="mb-12 text-center">
          <h1 className="font-display text-5xl md:text-6xl text-ink">
            Maps worthy of <span className="text-blood">heroes</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">
            A modern home for the HoMM3 community — browse, filter, review and
            download maps for SoD, HotA, WoG, Chronicles and beyond.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/maps"
              className="btn-brass rounded px-6 py-2.5 font-display"
            >
              Browse maps
            </Link>
            <Link
              href="/upload"
              className="rounded border border-ink/20 bg-parchment-dark/40 px-6 py-2.5 font-display text-ink hover:bg-parchment-dark/70"
            >
              Upload a map
            </Link>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-ink-soft">
            Browse by version
          </h2>
          <div className="flex flex-wrap gap-2">
            {VERSIONS.map((v) => (
              <Link
                key={v}
                href={`/maps?version=${v}`}
                title={v}
                className="rounded border border-brass/50 bg-parchment-dark/30 px-3 py-1 text-sm text-ink hover:bg-brass/20"
              >
                {VERSION_LABEL[v]}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Latest activity</h2>
            <Link
              href="/feed"
              className="text-sm text-blood hover:underline"
            >
              See full feed →
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Newly added */}
            <div className="card-brass rounded p-5">
              <h3 className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-ink-soft">
                ✦ Newly added
              </h3>
              <ul className="divide-y divide-brass/20">
                {recentlyAdded.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/maps/${m.slug}`}
                      className="flex items-center gap-3 py-2 hover:text-blood"
                    >
                      {m.previewKey ? (
                        <Image
                          src={m.previewKey}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded object-cover pixelated bg-night-deep"
                          unoptimized
                        />
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded bg-night-deep" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink group-hover:text-blood">
                          {m.name}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {versionLabel(m.version)} ·{" "}
                          {formatRelativeTime(m.addedAt)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Latest reviews */}
            <div className="card-brass rounded p-5">
              <h3 className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-ink-soft">
                ✦ Latest reviews
              </h3>
              {recentlyReviewed.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No reviews yet — be the first.
                </p>
              ) : (
                <ul className="divide-y divide-brass/20">
                  {recentlyReviewed.map((r) => (
                    <li key={r.reviewId} className="py-2">
                      <Link
                        href={`/maps/${r.mapSlug}`}
                        className="flex items-start gap-3 hover:text-blood"
                      >
                        {r.authorImage ? (
                          <Image
                            src={r.authorImage}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 flex-shrink-0 rounded-full border border-brass/40"
                            unoptimized
                          />
                        ) : (
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-brass/30" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium text-ink">
                              {r.mapName}
                            </span>
                            <span className="text-xs text-brass">
                              {"★".repeat(r.rating)}
                            </span>
                          </div>
                          <div className="text-xs text-ink-soft">
                            {r.authorName ?? "Anonymous"} ·{" "}
                            {formatRelativeTime(r.createdAt)}
                          </div>
                          {r.body && (
                            <p className="mt-1 line-clamp-1 text-xs text-ink-soft/90">
                              {r.body}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Top rated</h2>
            <Link
              href="/maps?sort=rating"
              className="text-sm text-blood hover:underline"
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featured.map((m, i) => (
              <MapCard
                key={m.id}
                map={m}
                signedIn={signedIn}
                imageSizes="(max-width: 768px) 100vw, 33vw"
                {...stagger(i)}
              />
            ))}
          </div>
        </section>
       </PageReveal>
      </main>

      <SiteFooter />
    </div>
  );
}
