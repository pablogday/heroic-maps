/**
 * Admin-only moderation queue. Lists every unresolved report (review
 * or comment) with the offending content quoted inline + the maps it
 * lives on, so the admin can decide quickly. Uses the env-driven
 * allow-list (`lib/admin.ts`).
 *
 * No editing UI here — actions live on the map detail page where the
 * admin already has full context. This page just helps you find the
 * thing that was flagged.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { reports, reviews, comments, users, maps } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";

export const metadata = { title: "Reports — Heroic Maps" };

export default async function AdminReportsPage() {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  if (!isAdmin(viewerId)) notFound();

  // Pull each unresolved report joined with the target's content +
  // map slug so the admin sees enough to decide without extra clicks.
  const reviewReports = await db
    .select({
      reportId: reports.id,
      reason: reports.reason,
      reportedAt: reports.createdAt,
      reporterName: users.name,
      reporterUsername: users.username,
      reviewId: reviews.id,
      reviewBody: reviews.body,
      reviewRating: reviews.rating,
      reviewDeletedAt: reviews.deletedAt,
      mapSlug: maps.slug,
      mapName: maps.name,
    })
    .from(reports)
    .innerJoin(reviews, and(eq(reports.targetId, reviews.id)))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .innerJoin(maps, eq(reviews.mapId, maps.id))
    .where(
      and(eq(reports.targetType, "review"), isNull(reports.resolvedAt))
    )
    .orderBy(desc(reports.createdAt));

  const commentReports = await db
    .select({
      reportId: reports.id,
      reason: reports.reason,
      reportedAt: reports.createdAt,
      reporterName: users.name,
      reporterUsername: users.username,
      commentId: comments.id,
      commentBody: comments.body,
      commentDeletedAt: comments.deletedAt,
      reviewId: comments.reviewId,
      mapSlug: maps.slug,
      mapName: maps.name,
    })
    .from(reports)
    .innerJoin(comments, and(eq(reports.targetId, comments.id)))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .innerJoin(reviews, eq(comments.reviewId, reviews.id))
    .innerJoin(maps, eq(reviews.mapId, maps.id))
    .where(
      and(eq(reports.targetType, "comment"), isNull(reports.resolvedAt))
    )
    .orderBy(desc(reports.createdAt));

  // Crude per-target counts so an item flagged 3× looks more urgent.
  const reviewCounts = await db
    .select({
      reviewId: reports.targetId,
      n: sql<number>`count(*)::int`,
    })
    .from(reports)
    .where(and(eq(reports.targetType, "review"), isNull(reports.resolvedAt)))
    .groupBy(reports.targetId);
  const commentCounts = await db
    .select({
      commentId: reports.targetId,
      n: sql<number>`count(*)::int`,
    })
    .from(reports)
    .where(and(eq(reports.targetType, "comment"), isNull(reports.resolvedAt)))
    .groupBy(reports.targetId);
  const reviewCountMap = new Map(reviewCounts.map((r) => [r.reviewId, r.n]));
  const commentCountMap = new Map(commentCounts.map((c) => [c.commentId, c.n]));

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <PageReveal>
          <h1 className="font-display text-3xl text-ink">Reports</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Unresolved user reports against reviews and comments. Click
            through to the map to soft-delete or dismiss.
          </p>

          <Section title={`Review reports (${reviewReports.length})`}>
            {reviewReports.length === 0 ? (
              <Empty>No open review reports.</Empty>
            ) : (
              <ul className="space-y-3">
                {reviewReports.map((r) => {
                  const count = reviewCountMap.get(r.reviewId) ?? 1;
                  return (
                    <Item
                      key={r.reportId}
                      slug={r.mapSlug}
                      mapName={r.mapName}
                      count={count}
                      reason={r.reason}
                      reporter={r.reporterName ?? r.reporterUsername ?? "?"}
                      reportedAt={r.reportedAt}
                      heading={`★${r.reviewRating} review`}
                      body={r.reviewBody}
                      isDeleted={!!r.reviewDeletedAt}
                    />
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={`Comment reports (${commentReports.length})`}>
            {commentReports.length === 0 ? (
              <Empty>No open comment reports.</Empty>
            ) : (
              <ul className="space-y-3">
                {commentReports.map((r) => {
                  const count = commentCountMap.get(r.commentId) ?? 1;
                  return (
                    <Item
                      key={r.reportId}
                      slug={r.mapSlug}
                      mapName={r.mapName}
                      count={count}
                      reason={r.reason}
                      reporter={r.reporterName ?? r.reporterUsername ?? "?"}
                      reportedAt={r.reportedAt}
                      heading="Comment"
                      body={r.commentBody}
                      isDeleted={!!r.commentDeletedAt}
                    />
                  );
                })}
              </ul>
            )}
          </Section>
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-brass/30 bg-parchment-dark/30 p-3 text-sm italic text-ink-soft">
      {children}
    </p>
  );
}

function Item({
  slug,
  mapName,
  count,
  reason,
  reporter,
  reportedAt,
  heading,
  body,
  isDeleted,
}: {
  slug: string;
  mapName: string;
  count: number;
  reason: string | null;
  reporter: string;
  reportedAt: Date;
  heading: string;
  body: string | null;
  isDeleted: boolean;
}) {
  return (
    <li className="rounded border border-brass/30 bg-parchment-dark/20 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/maps/${slug}`}
          className="font-display text-base text-ink hover:underline"
        >
          {mapName}
        </Link>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          {count > 1 && (
            <span className="rounded bg-blood/15 px-1.5 py-0.5 text-blood">
              ×{count}
            </span>
          )}
          {isDeleted && (
            <span className="rounded border border-brass/40 px-1.5 py-0.5">
              already removed
            </span>
          )}
          <time dateTime={reportedAt.toISOString()}>
            {reportedAt.toLocaleString()}
          </time>
        </div>
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wider text-ink-soft/80">
        {heading}
      </div>
      <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-ink">
        {body ?? "(no text)"}
      </p>
      <div className="mt-2 rounded border-l-2 border-blood/40 bg-parchment/60 px-2 py-1 text-xs">
        <div className="text-ink-soft">
          Reported by <span className="text-ink">{reporter}</span> —
        </div>
        <p className="mt-0.5 italic text-ink">{reason ?? "(no reason)"}</p>
      </div>
    </li>
  );
}
