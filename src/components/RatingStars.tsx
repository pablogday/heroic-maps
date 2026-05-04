/**
 * Five-star rating display: filled stars in brass, remainder in
 * dimmed ink. Used in the review list, feed, profile, and the home
 * activity strip — anywhere we render a single user's star rating
 * without the brass-bordered count badge (`<RatingBadge>` covers
 * that other shape).
 *
 * Defensive bounds: clamps to 0..5 in case a stray value sneaks
 * through from the DB. `aria-label` reads as "4 out of 5 stars" so
 * the row is meaningful to screen readers without dropping a span
 * that says "★★★★☆".
 */

const FILLED = "★";
const EMPTY = "★"; // same glyph; we change color via the wrapping span

export function RatingStars({
  rating,
  className = "",
}: {
  rating: number;
  className?: string;
}) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className={`text-xs text-brass ${className}`}
      role="img"
      aria-label={`${r} out of 5 stars`}
    >
      <span aria-hidden>{FILLED.repeat(r)}</span>
      <span aria-hidden className="text-ink-soft/30">
        {EMPTY.repeat(5 - r)}
      </span>
    </span>
  );
}
