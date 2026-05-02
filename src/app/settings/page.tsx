import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { SettingsForm } from "./SettingsForm";

export const metadata = {
  title: "Settings — Heroic Maps",
};

export default async function SettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const [me] = await db
    .select({
      username: users.username,
      bio: users.bio,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!me) redirect("/");

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <PageReveal>
          <h1 className="font-display text-4xl text-ink">Settings</h1>
          <p className="mt-2 text-ink-soft">
            Tune how you appear on the site.
          </p>
          <div className="card-brass mt-8 rounded p-6">
            <SettingsForm
              initial={{ username: me.username ?? "", bio: me.bio ?? "" }}
            />
          </div>
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}
