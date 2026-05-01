import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { signInDiscord } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = {
  title: "Upload a map",
  description:
    "Submit your custom Heroes 3 map to Heroic Maps — host the file, fill in the metadata, share with the community.",
};

export default async function UploadPage() {
  const session = await auth();

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-4xl text-ink">Upload a map</h1>
        <p className="mt-3 text-ink-soft">
          Drop a <code>.h3m</code>, <code>.h3c</code> or <code>.zip</code>, fill
          in the details, and your map goes live.
        </p>

        {session?.user ? (
          <div className="card-brass mt-8 rounded p-6">
            <UploadForm />
          </div>
        ) : (
          <div className="card-brass mt-8 rounded p-6">
            <h2 className="font-display text-lg text-ink">
              Sign in to upload
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Maps are tied to your account so reviewers know who made them.
            </p>
            <form action={signInDiscord} className="mt-4">
              <button
                type="submit"
                className="btn-brass rounded px-4 py-2 text-sm font-display"
              >
                Sign in with Discord
              </button>
            </form>
          </div>
        )}

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
