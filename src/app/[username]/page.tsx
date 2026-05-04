import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  reviews,
  maps,
  playSessions,
  userMaps,
} from "@/db/schema";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageReveal } from "@/components/PageReveal";
import { MapCard } from "@/components/MapCard";
import { stagger } from "@/lib/stagger";
import { FACTION_LABEL, type Faction } from "@/lib/factions";
import { RESERVED_USERNAMES } from "@/lib/reserved-usernames";
import { mapCardCols, type MapCardData } from "@/lib/maps";
import { RatingStars } from "@/components/RatingStars";

type Params = Promise<{ username: string }>;

const OUTCOME_LABEL = { won: "Won", lost: "Lost", abandoned: "Abandoned" };
const OUTCOME_COLOR = {
  won: "text-emerald",
  lost: "text-blood",
  abandoned: "text-ink-soft",
};

// MapCard SELECT shape lives in lib/maps.ts as `mapCardCols`. We use
// it directly below; alias kept terse with a local rename.
const cardCols = mapCardCols;

async function loadUser(username: string) {
  if (RESERVED_USERNAMES.has(username)) return null;
  const lower = username.toLowerCase();
  const [u] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      image: users.image,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, lower))
    .limit(1);
  return u ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const u = await loadUser(username);
  if (!u) return { title: "User not found" };
  const display = u.name ?? u.username;
  return {
    title: `${display} — Heroic Maps`,
    description: u.bio ?? `${display}'s playthroughs and reviews on Heroic Maps.`,
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const profile = await loadUser(username);
  if (!profile) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === profile.id;

  const [reviewRows, sessionRows, favoriteMaps, uploadedMaps, stats] =
    await Promise.all([
      // Recent reviews
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          body: reviews.body,
          createdAt: reviews.createdAt,
          mapSlug: maps.slug,
          mapName: maps.name,
          mapPreview: maps.previewKey,
        })
        .from(reviews)
        .innerJoin(maps, eq(reviews.mapId, maps.id))
        .where(eq(reviews.userId, profile.id))
        .orderBy(desc(reviews.createdAt))
        .limit(10),
      // Public play sessions
      db
        .select({
          id: playSessions.id,
          playedAt: playSessions.playedAt,
          faction: playSessions.faction,
          outcome: playSessions.outcome,
          durationDays: playSessions.durationDays,
          notes: playSessions.notes,
          mapSlug: maps.slug,
          mapName: maps.name,
        })
        .from(playSessions)
        .innerJoin(maps, eq(playSessions.mapId, maps.id))
        .where(
          and(
            eq(playSessions.userId, profile.id),
            // Owner sees private sessions too
            isOwner ? undefined : eq(playSessions.isPublic, true)
          )
        )
        .orderBy(desc(playSessions.playedAt))
        .limit(20),
      // Favorites
      db
        .select(cardCols)
        .from(userMaps)
        .innerJoin(maps, eq(userMaps.mapId, maps.id))
        .where(
          and(
            eq(userMaps.userId, profile.id),
            eq(userMaps.favorited, true)
          )
        )
        .orderBy(desc(userMaps.updatedAt))
        .limit(6),
      // Uploaded maps
      db
        .select(cardCols)
        .from(maps)
        .where(eq(maps.uploaderId, profile.id))
        .orderBy(desc(maps.createdAt))
        .limit(12),
      // Aggregate stats
      db
        .select({
          totalReviews: sql<number>`(SELECT COUNT(*)::int FROM ${reviews} WHERE ${reviews.userId} = ${profile.id})`,
          publicSessions: sql<number>`(SELECT COUNT(*)::int FROM ${playSessions} WHERE ${playSessions.userId} = ${profile.id} AND ${playSessions.isPublic} = true)`,
          wins: sql<number>`(SELECT COUNT(*)::int FROM ${playSessions} WHERE ${playSessions.userId} = ${profile.id} AND ${playSessions.isPublic} = true AND ${playSessions.outcome} = 'won')`,
          losses: sql<number>`(SELECT COUNT(*)::int FROM ${playSessions} WHERE ${playSessions.userId} = ${profile.id} AND ${playSessions.isPublic} = true AND ${playSessions.outcome} = 'lost')`,
          uploaded: sql<number>`(SELECT COUNT(*)::int FROM ${maps} WHERE ${maps.uploaderId} = ${profile.id})`,
        })
        .from(users)
        .where(eq(users.id, profile.id))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

  const avatar = profile.avatarUrl ?? profile.image;
  const display = profile.name ?? profile.username;

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <PageReveal>
          {/* Header */}
          <header className="card-brass mb-6 flex flex-col items-start gap-4 rounded p-6 sm:flex-row sm:items-center">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 rounded-full border-2 border-brass/60"
                unoptimized
              />
            ) : (
              <div className="h-20 w-20 rounded-full border-2 border-brass/60 bg-brass/30" />
            )}
            <div className="flex-1">
              <h1 className="font-display text-3xl text-ink">{display}</h1>
              <p className="text-sm text-ink-soft">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-2 max-w-prose text-sm text-ink">
                  {profile.bio}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-soft">
                Joined{" "}
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            {isOwner && (
              <Link
                href="/settings"
                className="rounded border border-brass/50 px-3 py-1.5 text-sm text-ink-soft hover:bg-brass/15 hover:text-ink"
              >
                Edit profile
              </Link>
            )}
          </header>

          {/* Stat strip */}
          {stats && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Reviews" value={stats.totalReviews} />
              <Stat label="Playthroughs" value={stats.publicSessions} />
              <Stat
                label="Won"
                value={stats.wins}
                tint="text-emerald"
              />
              <Stat label="Lost" value={stats.losses} tint="text-blood" />
              <Stat label="Uploaded" value={stats.uploaded} />
            </div>
          )}

          {/* Uploaded maps */}
          {uploadedMaps.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-xl text-ink">
                Maps {display} uploaded
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {uploadedMaps.map((m, i) => (
                  <MapCard
                    key={m.id}
                    map={m as MapCardData}
                    signedIn={!!session?.user}
                    {...stagger(i)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent playthroughs */}
          <section className="mb-8">
            <h2 className="mb-3 font-display text-xl text-ink">
              Recent playthroughs
            </h2>
            {sessionRows.length === 0 ? (
              <p className="text-sm text-ink-soft">
                {isOwner
                  ? "You haven't logged any playthroughs yet — pick a map and hit “Played”."
                  : `${display} hasn't shared any playthroughs yet.`}
              </p>
            ) : (
              <ul className="space-y-2">
                {sessionRows.map((s) => (
                  <li
                    key={s.id}
                    className="card-brass rounded p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        href={`/maps/${s.mapSlug}`}
                        className="font-medium text-ink hover:text-blood"
                      >
                        {s.mapName}
                      </Link>
                      <span
                        className={
                          OUTCOME_COLOR[
                            s.outcome as keyof typeof OUTCOME_COLOR
                          ]
                        }
                      >
                        ⚔{" "}
                        {
                          OUTCOME_LABEL[
                            s.outcome as keyof typeof OUTCOME_LABEL
                          ]
                        }
                      </span>
                      {s.faction && (
                        <span className="text-ink-soft">
                          as{" "}
                          {FACTION_LABEL[s.faction as Faction] ?? s.faction}
                        </span>
                      )}
                      {s.durationDays !== null && (
                        <span className="text-ink-soft">
                          · {s.durationDays} day
                          {s.durationDays === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-ink-soft">
                        {new Date(s.playedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">
                        {s.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent reviews */}
          {reviewRows.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-xl text-ink">
                Recent reviews
              </h2>
              <ul className="space-y-2">
                {reviewRows.map((r) => (
                  <li
                    key={r.id}
                    className="card-brass rounded p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        href={`/maps/${r.mapSlug}`}
                        className="font-medium text-ink hover:text-blood"
                      >
                        {r.mapName}
                      </Link>
                      <RatingStars rating={r.rating} />
                      <span className="ml-auto text-xs text-ink-soft">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.body && (
                      <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">
                        {r.body}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Favorites */}
          {favoriteMaps.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-xl text-ink">Favorites</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteMaps.map((m, i) => (
                  <MapCard
                    key={m.id}
                    map={m as MapCardData}
                    signedIn={!!session?.user}
                    {...stagger(i)}
                  />
                ))}
              </div>
            </section>
          )}
        </PageReveal>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="card-brass rounded p-3 text-center">
      <div className={`font-display text-2xl ${tint ?? "text-ink"}`}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-ink-soft">
        {label}
      </div>
    </div>
  );
}
