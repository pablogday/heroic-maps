/**
 * Themed loader: a parchment scroll unfurling with a flickering torch icon.
 * Use as a drop-in replacement for plain skeletons in `loading.tsx` files.
 */
export function ScrollLoader({
  message = "Unfurling the scroll…",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Torch />
      <div className="card-brass animate-unfurl w-full max-w-md rounded p-6 text-center">
        <p className="font-display text-base text-ink">{message}</p>
        <div className="mt-4 space-y-2">
          <div className="parchment-shimmer h-2.5 w-full rounded" />
          <div className="parchment-shimmer h-2.5 w-5/6 rounded" />
          <div className="parchment-shimmer h-2.5 w-2/3 rounded" />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

function Torch() {
  return (
    <svg
      width="42"
      height="56"
      viewBox="0 0 42 56"
      aria-hidden
      className="animate-flicker"
    >
      {/* Flame outer */}
      <path
        d="M21 2 C 14 14, 8 16, 12 28 C 14 34, 18 36, 21 36 C 24 36, 28 34, 30 28 C 34 16, 28 14, 21 2 Z"
        fill="#e0b656"
      />
      {/* Flame inner */}
      <path
        d="M21 10 C 17 18, 14 20, 17 28 C 19 32, 21 33, 21 33 C 21 33, 23 32, 25 28 C 28 20, 25 18, 21 10 Z"
        fill="#fff1c4"
      />
      {/* Handle / wood */}
      <rect x="18" y="34" width="6" height="20" rx="1" fill="#5a3a1a" />
      <rect x="16" y="34" width="10" height="3" fill="#3a2410" />
    </svg>
  );
}
