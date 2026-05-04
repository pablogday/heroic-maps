/**
 * Reviews section of the map detail page. Composes:
 *   - the AI summary banner (if present)
 *   - the compose-or-edit form for the viewer's own review
 *   - the list of other reviewers' reviews, each with helpful /
 *     report / admin-remove actions and its comment thread
 *
 * Pulled out of `page.tsx` to keep that file navigable. Pure server
 * component — the interactive bits (form, comment thread, buttons)
 * are already their own client components.
 */
import Image from "next/image";
import Link from "next/link";

import { signInDiscord } from "@/app/actions/auth";
import { EmptyState } from "@/components/EmptyState";
import { RatingStars } from "@/components/RatingStars";
import { StatIcon } from "@/components/StatIcon";

import { AdminRemoveReview } from "./AdminRemoveReview";
import { CommentThread } from "./CommentThread";
import { HelpfulButton } from "./HelpfulButton";
import { ReportButton } from "./ReportButton";
import { ReviewForm } from "./ReviewForm";

interface ReviewRow {
  id: number;
  userId: string;
  rating: number;
  body: string | null;
  createdAt: Date | string;
  helpfulCount: number;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
}

interface MyReview {
  id: number;
  rating: number;
  body: string | null;
  createdAt: Date | string;
  deletedAt: Date | string | null;
}

interface CommentRow {
  id: number;
  reviewId: number;
  userId: string;
  body: string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
}

export function ReviewsSection({
  map,
  avgRating,
  reviewSort,
  viewerId,
  viewerIsAdmin,
  myReview,
  otherReviews,
  myReactionIds,
  commentsByReview,
}: {
  map: {
    id: number;
    slug: string;
    ratingCount: number;
    aiSummary: string | null;
    aiSummaryReviewCount: number;
  };
  avgRating: number | null;
  reviewSort: "newest" | "helpful";
  viewerId: string | null;
  viewerIsAdmin: boolean;
  myReview: MyReview | undefined;
  otherReviews: ReviewRow[];
  myReactionIds: Set<number>;
  commentsByReview: Map<number, CommentRow[]>;
}) {
  return (
    <section className="card-brass mt-4 rounded p-5">
      <Header
        slug={map.slug}
        avgRating={avgRating}
        ratingCount={map.ratingCount}
        otherCount={otherReviews.length}
        reviewSort={reviewSort}
      />

      {map.aiSummary && (
        <AiSummary
          body={map.aiSummary}
          reviewCount={map.aiSummaryReviewCount}
        />
      )}

      <ComposeBlock
        viewerId={viewerId}
        myReview={myReview}
        mapId={map.id}
        slug={map.slug}
      />

      {otherReviews.length === 0 && !myReview ? (
        <EmptyState
          icon={<StatIcon name="quill" size={42} />}
          title="The chronicles are blank"
          body="No hero has yet penned a tale of this realm — be the first to take up the quill."
        />
      ) : (
        <ul className="space-y-4">
          {otherReviews.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              slug={map.slug}
              viewerId={viewerId}
              viewerIsAdmin={viewerIsAdmin}
              isReacting={myReactionIds.has(r.id)}
              comments={commentsByReview.get(r.id) ?? []}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- pieces ---------- */

function Header({
  slug,
  avgRating,
  ratingCount,
  otherCount,
  reviewSort,
}: {
  slug: string;
  avgRating: number | null;
  ratingCount: number;
  otherCount: number;
  reviewSort: "newest" | "helpful";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-lg text-ink">Reviews</h2>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-soft">
          {avgRating != null
            ? `★ ${avgRating.toFixed(1)} · ${ratingCount} rating${
                ratingCount === 1 ? "" : "s"
              }`
            : "No ratings yet"}
        </span>
        {otherCount > 1 && (
          <div className="inline-flex overflow-hidden rounded border border-brass/40 text-xs">
            <Link
              href={`/maps/${slug}`}
              scroll={false}
              className={`px-2 py-0.5 transition-colors ${
                reviewSort === "newest"
                  ? "bg-brass/20 text-ink"
                  : "text-ink-soft hover:bg-brass/15"
              }`}
            >
              Newest
            </Link>
            <Link
              href={`/maps/${slug}?reviewSort=helpful`}
              scroll={false}
              className={`px-2 py-0.5 transition-colors ${
                reviewSort === "helpful"
                  ? "bg-brass/20 text-ink"
                  : "text-ink-soft hover:bg-brass/15"
              }`}
            >
              Most helpful
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AiSummary({
  body,
  reviewCount,
}: {
  body: string;
  reviewCount: number;
}) {
  return (
    <div className="mb-5 rounded border border-brass/40 bg-night-deep/40 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-brass">
        <span aria-hidden>✦</span>
        <span>AI summary</span>
        <span className="text-ink-soft/70 normal-case tracking-normal">
          · based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-sm text-parchment/90 leading-relaxed">{body}</p>
    </div>
  );
}

function ComposeBlock({
  viewerId,
  myReview,
  mapId,
  slug,
}: {
  viewerId: string | null;
  myReview: MyReview | undefined;
  mapId: number;
  slug: string;
}) {
  if (!viewerId) {
    return (
      <div className="mb-5 flex items-center justify-between rounded border border-brass/30 bg-parchment-dark/30 p-4">
        <p className="text-sm text-ink-soft">Sign in to rate this map.</p>
        <form action={signInDiscord}>
          <button
            type="submit"
            className="btn-brass rounded px-3 py-1.5 text-xs font-display"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }
  return (
    <div className="mb-5 rounded border border-brass/30 bg-parchment-dark/30 p-4">
      {myReview?.deletedAt ? (
        <p className="text-sm italic text-ink-soft">
          Your review was removed by a moderator.
        </p>
      ) : (
        <>
          <div className="mb-2 text-xs uppercase tracking-wider text-ink-soft">
            {myReview ? "Your review" : "Leave a review"}
          </div>
          <ReviewForm
            mapId={mapId}
            slug={slug}
            initialRating={myReview?.rating}
            initialBody={myReview?.body}
            reviewId={myReview?.id}
          />
        </>
      )}
    </div>
  );
}

function ReviewItem({
  review,
  slug,
  viewerId,
  viewerIsAdmin,
  isReacting,
  comments,
}: {
  review: ReviewRow;
  slug: string;
  viewerId: string | null;
  viewerIsAdmin: boolean;
  isReacting: boolean;
  comments: CommentRow[];
}) {
  return (
    <li className="border-b border-brass/20 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        {review.authorImage ? (
          <Image
            src={review.authorImage}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-full border border-brass/40"
            unoptimized
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-brass/30" />
        )}
        {review.authorUsername ? (
          <Link
            href={`/${review.authorUsername}`}
            className="text-sm font-medium text-ink hover:text-blood"
          >
            {review.authorName ?? "Anonymous"}
          </Link>
        ) : (
          <span className="text-sm font-medium text-ink">
            {review.authorName ?? "Anonymous"}
          </span>
        )}
        <RatingStars rating={review.rating} />
        <span className="ml-auto text-xs text-ink-soft">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      {review.body && (
        <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
          {review.body}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <HelpfulButton
          reviewId={review.id}
          slug={slug}
          initialCount={review.helpfulCount}
          initialReacting={isReacting}
          signedIn={!!viewerId}
        />
        {viewerId && review.userId !== viewerId && (
          <ReportButton
            targetType="review"
            targetId={review.id}
            slug={slug}
          />
        )}
        {viewerIsAdmin && (
          <AdminRemoveReview reviewId={review.id} slug={slug} />
        )}
      </div>
      <CommentThread
        reviewId={review.id}
        slug={slug}
        viewerId={viewerId ?? null}
        viewerIsAdmin={viewerIsAdmin}
        initialComments={comments}
      />
    </li>
  );
}
