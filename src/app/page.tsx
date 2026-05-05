import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import {
  RecentlyAddedCard,
  RecentlyAddedSkeleton,
  RecentlyReviewedCard,
  RecentlyReviewedSkeleton,
} from "@/components/HomeActivityStrip";
import {
  MapOfTheDayCard,
  MapOfTheDaySkeleton,
} from "@/components/MapOfTheDay";
import { getFeaturedMaps, VERSIONS } from "@/lib/maps";
import { VERSION_LABEL } from "@/lib/map-constants";
import { stagger } from "@/lib/stagger";

export default async function Home() {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const signedIn = viewerId != null;

  // Featured stays inline (it's above the fold). The activity strip
  // streams in via <Suspense> below so the rest of the page paints
  // immediately on cold-cache visits.
  const featured = await getFeaturedMaps(3, viewerId);

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

        {/* Daily-rotating featured pick — same map for everyone in
          * a given UTC day, fresh tomorrow. Streamed via Suspense
          * so the rest of the page paints first. */}
        <section className="mb-10">
          <Suspense fallback={<MapOfTheDaySkeleton />}>
            <MapOfTheDayCard viewerId={viewerId} />
          </Suspense>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
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
            {/* Each card streams independently — Suspense fallback shows
             * a parchment-shimmer skeleton until the Neon round-trip
             * resolves. Layout heights match so nothing jumps. */}
            <Suspense fallback={<RecentlyAddedSkeleton />}>
              <RecentlyAddedCard />
            </Suspense>
            <Suspense fallback={<RecentlyReviewedSkeleton />}>
              <RecentlyReviewedCard />
            </Suspense>
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
