import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { maps } from "@/db/schema";

/**
 * Pick a random map weighted by quality signals (rating count, downloads,
 * source rating from maps4heroes). Better-loved maps surface more often
 * than lonely scraped junk.
 *
 * Uses TABLESAMPLE to avoid ORDER BY random() over the whole 2,966-row
 * table on every hit.
 */
export async function GET() {
  const rows = (await db.execute(sql`
    SELECT slug
    FROM maps
    WHERE file_key LIKE 'http%'
    ORDER BY (
      random()
      * (1 + LEAST(${maps.ratingCount}, 50)::float / 50)
      * (1 + LEAST(${maps.downloadCount}, 1000)::float / 1000)
    ) DESC
    LIMIT 1
  `)) as unknown as Array<{ slug: string }>;

  const row = rows[0];
  if (!row) {
    return NextResponse.redirect(new URL("/maps", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }
  return NextResponse.redirect(
    new URL(`/maps/${row.slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    { status: 302 }
  );
}
