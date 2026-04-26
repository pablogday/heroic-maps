/**
 * Resolve `promise` no sooner than `ms` milliseconds.
 *
 * Used to guarantee the themed `loading.tsx` skeleton is visible long
 * enough to register as an animation rather than a flash. Server-side
 * only — adds artificial latency, so use it sparingly on routes whose
 * loading state we actually want users to see.
 */
export function minDelay<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.all([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]).then(([value]) => value);
}
