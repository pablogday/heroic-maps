import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { signInDiscord } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Upload a map",
  description:
    "Submit your custom Heroes 3 map to Heroic Maps. Self-serve uploads coming soon.",
};

export default async function UploadPage() {
  const session = await auth();

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-4xl text-ink">Upload a map</h1>
        <p className="mt-3 text-ink-soft">
          Self-serve uploads aren&apos;t live yet — but they&apos;re next.
        </p>

        <div className="card-brass mt-8 rounded p-6">
          <h2 className="font-display text-lg text-ink">Coming soon</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              · Drop a <code>.h3m</code>, <code>.h3c</code> or{" "}
              <code>.zip</code> — we&apos;ll parse the metadata for you
            </li>
            <li>· Auto-generated surface + underground previews</li>
            <li>· Edit the description, tag the version, add credits</li>
            <li>· Files hosted on our CDN, not borrowed</li>
          </ul>
        </div>

        <div className="card-brass mt-4 rounded p-6">
          <h2 className="font-display text-lg text-ink">In the meantime</h2>
          {session?.user ? (
            <p className="mt-3 text-sm text-ink-soft">
              You&apos;re signed in as{" "}
              <span className="font-medium text-ink">
                {session.user.name}
              </span>
              . Once uploads ship, your maps will be tied to your account
              automatically.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-ink-soft">
              <p>
                Sign in with Discord now and your maps will be linked to your
                account once uploads go live.
              </p>
              <form action={signInDiscord}>
                <button
                  type="submit"
                  className="btn-brass rounded px-4 py-2 text-sm font-display"
                >
                  Sign in with Discord
                </button>
              </form>
            </div>
          )}
          <p className="mt-4 text-xs text-ink-soft/80">
            Got a map you want listed sooner? Hit us up via the project&apos;s
            GitHub issues.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/maps" className="text-sm text-blood hover:underline">
            ← Back to browse
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
