/**
 * Per-item props for staggered card grids. Pass the array index, get a
 * className + inline style ready to spread onto a `<MapCard>` (or any
 * element).
 *
 * Delay is capped so a 24-card page doesn't take forever to settle.
 */
export function stagger(
  index: number,
  step = 65,
  cap = 800
): { className: string; style: { animationDelay: string } } {
  const delay = Math.min(index * step, cap);
  return {
    className: "animate-card-rise",
    style: { animationDelay: `${delay}ms` },
  };
}
