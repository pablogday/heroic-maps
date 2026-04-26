import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-brass/40 bg-night-deep py-6 text-parchment/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center text-xs">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link className="hover:text-brass-bright" href="/maps">
            Browse
          </Link>
          <Link className="hover:text-brass-bright" href="/feed">
            Feed
          </Link>
          <Link className="hover:text-brass-bright" href="/stats">
            Stats
          </Link>
          <Link className="hover:text-brass-bright" href="/upload">
            Upload
          </Link>
        </div>
        <p>
          Heroic Maps — a fan-made tribute. Heroes of Might and Magic III is a
          trademark of Ubisoft.
        </p>
      </div>
    </footer>
  );
}
