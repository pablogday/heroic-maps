import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { mapSeriesTable, maps, userMaps } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import { mapCardCols, type MapCardData } from "@/lib/maps";
import { stagger } from "@/lib/stagger";

type Params = Promise<{ slug: string }>;

const KIND_LABEL: Record<string, string> = {
  sequel: "Sequel series",
  variant: "Difficulty variants",
  remake: "Remakes & re-edits",
};

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const [s] = await db
    .select({ name: mapSeriesTable.name })
    .from(mapSeriesTable)
    .where(eq(mapSeriesTable.slug, slug))
    .limit(1);
  if (!s) return { title: "Series not found — Heroic Maps" };
  return { title: `${s.name} — Heroic Maps` };
}

export default async function SeriesPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;

  const [series] = await db
    .select()
    .from(mapSeriesTable)
    .where(eq(mapSeriesTable.slug, slug))
    .limit(1);

  if (!series) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const signedIn = viewerId != null;

  // Pull every map in the series, ordered by position.
  const rows = await db
    .select({
      ...mapCardCols,
      seriesPosition: maps.seriesPosition,
      bookmarked: sql<boolean>`COALESCE(${userMaps.bookmarked}, false)`,
      favorited: sql<boolean>`COALESCE(${userMaps.favorited}, false)`,
    })
    .from(maps)
    .leftJoin(
      userMaps,
      sql`${userMaps.mapId} = ${maps.id} AND ${userMaps.userId} = ${
        viewerId ?? "__no_viewer__"
      }`
    )
    .where(eq(maps.seriesId, series.id))
    .orderBy(sql`${maps.seriesPosition} ASC NULLS LAST`, maps.name);

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <PageReveal>
          <Link
            href="/maps"
            className="mb-4 inline-block text-sm text-blood hover:underline"
          >
            ← Back to browse
          </Link>

          <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brass">
            {KIND_LABEL[series.kind] ?? series.kind}
          </div>
          <h1 className="font-display text-4xl text-ink">{series.name}</h1>
          {series.description && (
            <p className="mt-2 max-w-2xl text-ink-soft">
              {series.description}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-soft">
            {rows.length} {rows.length === 1 ? "map" : "maps"} in this series
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r, i) => (
              <MapCard
                key={r.id}
                map={r as MapCardData}
                signedIn={signedIn}
                {...stagger(i)}
                badge={
                  r.seriesPosition != null ? (
                    <span className="font-display text-brass">
                      #{r.seriesPosition}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}
