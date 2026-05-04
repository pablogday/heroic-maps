import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { EmptyState } from "@/components/EmptyState";
import { RatingStars } from "@/components/RatingStars";
import { getRecentlyAdded, getRecentlyReviewed } from "@/lib/maps";
import { formatRelativeTime } from "@/lib/relative-time";

export const metadata = {
  title: "Feed — Heroic Maps",
  description: "Newly added maps and the latest community reviews.",
};

type FeedItem =
  | {
      kind: "added";
      key: string;
      ts: number;
      slug: string;
      name: string;
      version: string;
      previewKey: string | null;
    }
  | {
      kind: "reviewed";
      key: string;
      ts: number;
      slug: string;
      name: string;
      previewKey: string | null;
      rating: number;
      body: string | null;
      authorName: string | null;
      authorImage: string | null;
    };

export default async function FeedPage() {
  const [added, reviewed] = await Promise.all([
    getRecentlyAdded(40),
    getRecentlyReviewed(40),
  ]);

  // Merge into one chronological stream (newest first).
  const items: FeedItem[] = [
    ...added.map<FeedItem>((m) => ({
      kind: "added",
      key: `a-${m.id}`,
      ts: new Date(m.addedAt).getTime(),
      slug: m.slug,
      name: m.name,
      version: m.version,
      previewKey: m.previewKey,
    })),
    ...reviewed.map<FeedItem>((r) => ({
      kind: "reviewed",
      key: `r-${r.reviewId}`,
      ts: new Date(r.createdAt).getTime(),
      slug: r.mapSlug,
      name: r.mapName,
      previewKey: r.mapPreview,
      rating: r.rating,
      body: r.body,
      authorName: r.authorName,
      authorImage: r.authorImage,
    })),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
       <PageReveal>
        <div className="mb-8">
          <h1 className="font-display text-4xl text-ink">The Realm Today</h1>
          <p className="mt-2 text-ink-soft">
            New arrivals and fresh reviews, newest first.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            glyph="📜"
            title="The realm is quiet"
            body="No new arrivals or reviews yet. Check back soon — or seed the feed yourself."
            cta={{ href: "/maps", label: "Browse maps" }}
          />
        ) : (
          <ol className="relative space-y-4 border-l border-brass/40 pl-6">
            {items.map((it) => (
              <li key={it.key} className="relative">
                <span
                  className={`absolute -left-[29px] top-3 inline-flex h-3 w-3 items-center justify-center rounded-full border-2 border-brass ${
                    it.kind === "added" ? "bg-emerald" : "bg-blood"
                  }`}
                  aria-hidden
                />
                <div className="card-brass rounded p-4">
                  {it.kind === "added" ? (
                    <AddedItem item={it} />
                  ) : (
                    <ReviewedItem item={it} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
       </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function AddedItem({
  item,
}: {
  item: Extract<FeedItem, { kind: "added" }>;
}) {
  return (
    <Link
      href={`/maps/${item.slug}`}
      className="flex items-center gap-3 hover:text-blood"
    >
      {item.previewKey ? (
        <Image
          src={item.previewKey}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 flex-shrink-0 rounded object-cover pixelated bg-night-deep"
          unoptimized
        />
      ) : (
        <div className="h-12 w-12 flex-shrink-0 rounded bg-night-deep" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-emerald">
          New map added
        </div>
        <div className="truncate font-display text-ink">{item.name}</div>
        <div className="text-xs text-ink-soft">
          {item.version} · {formatRelativeTime(item.ts)}
        </div>
      </div>
    </Link>
  );
}

function ReviewedItem({
  item,
}: {
  item: Extract<FeedItem, { kind: "reviewed" }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-blood">
        New review
      </div>
      <Link
        href={`/maps/${item.slug}`}
        className="flex items-start gap-3 hover:text-blood"
      >
        {item.previewKey ? (
          <Image
            src={item.previewKey}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 flex-shrink-0 rounded object-cover pixelated bg-night-deep"
            unoptimized
          />
        ) : (
          <div className="h-12 w-12 flex-shrink-0 rounded bg-night-deep" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-display text-ink">{item.name}</span>
            <RatingStars rating={item.rating} />
          </div>
          <div className="text-xs text-ink-soft">
            {item.authorName ?? "Anonymous"} · {formatRelativeTime(item.ts)}
          </div>
        </div>
      </Link>
      {item.body && (
        <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
          {item.body.length > 240 ? `${item.body.slice(0, 240)}…` : item.body}
        </p>
      )}
    </div>
  );
}
