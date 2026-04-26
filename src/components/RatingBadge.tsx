/**
 * Shows the map's user-review rating.
 *   - With reviews: "★ 4.0 (16)"
 *   - Without:      "★ —"
 *
 * Note: maps4heroes' own popularity score is shown only on the detail page,
 * not here, since its scale isn't known to be 1–5.
 */
export function RatingBadge({
  ratingSum,
  ratingCount,
  className = "",
}: {
  ratingSum: number;
  ratingCount: number;
  className?: string;
}) {
  if (ratingCount > 0) {
    const avg = (ratingSum / ratingCount).toFixed(1);
    return (
      <span className={className}>
        ★ {avg} ({ratingCount})
      </span>
    );
  }
  return <span className={`text-ink-soft/60 ${className}`}>★ —</span>;
}
