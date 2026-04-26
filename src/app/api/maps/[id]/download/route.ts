import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { maps } from "@/db/schema";

const UA = "HeroicMaps/0.1 (hobby)";

// Pull the source map id out of file_key (we stored "source:NNNN" during scrape).
const sourceIdFromKey = (key: string): number | null => {
  const m = key.match(/^source:(\d+)$/);
  return m ? Number(m[1]) : null;
};

const ZIP_HREF =
  /href=["'](https?:\/\/www\.maps4heroes\.com\/heroes3\/maps\/[^"']+\.(?:zip|h3m|h3c|rar))["']/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [m] = await db
    .select({ fileKey: maps.fileKey, slug: maps.slug })
    .from(maps)
    .where(eq(maps.id, numericId))
    .limit(1);

  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sourceId = sourceIdFromKey(m.fileKey);
  if (!sourceId) {
    return NextResponse.json(
      { error: "Map not yet hosted locally — file unavailable" },
      { status: 501 }
    );
  }

  const ratingUrl = `https://www.maps4heroes.com/heroes3/rating.php?testcookie=1&id=${sourceId}`;
  const res = await fetch(ratingUrl, {
    headers: { "User-Agent": UA, Cookie: "testcookie=1" },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream ${res.status}` },
      { status: 502 }
    );
  }
  const html = await res.text();
  const match = html.match(ZIP_HREF);
  if (!match) {
    return NextResponse.json(
      { error: "Download URL not found in source response" },
      { status: 502 }
    );
  }

  // Increment download counter (best-effort).
  await db
    .update(maps)
    .set({ downloadCount: sql`${maps.downloadCount} + 1` })
    .where(eq(maps.id, numericId));

  return NextResponse.redirect(match[1], 302);
}
