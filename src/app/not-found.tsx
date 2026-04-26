import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20 text-center">
        <div className="font-display text-8xl text-brass">404</div>
        <h1 className="mt-4 font-display text-3xl text-ink">
          The map is uncharted
        </h1>
        <p className="mt-3 text-ink-soft">
          We couldn&apos;t find what you were looking for. Maybe it scrolled
          off the edge of the world.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded border border-brass/50 px-4 py-2 text-sm text-ink hover:bg-brass/20"
          >
            Home
          </Link>
          <Link
            href="/maps"
            className="btn-brass rounded px-4 py-2 text-sm font-display"
          >
            Browse all maps
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
