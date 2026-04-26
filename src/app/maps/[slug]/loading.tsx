import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollLoader } from "@/components/ScrollLoader";

export default function Loading() {
  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="page-in mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <ScrollLoader message="Unrolling the map…" />
      </main>
      <SiteFooter />
    </div>
  );
}
