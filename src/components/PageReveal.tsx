"use client";

import { useEffect, useState } from "react";

/**
 * Wrap route content so it fades + rises in on mount. Unlike a CSS-only
 * `animation` class, the state flip guarantees the transition fires every
 * time even when React reconciles a stable DOM node across Suspense
 * boundaries.
 */
export function PageReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
        ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${className}`}
    >
      {children}
    </div>
  );
}
