import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { maps } from "@/db/schema";
import { versionLabel } from "@/lib/map-constants";

export const runtime = "nodejs";
export const alt = "Map preview — Heroic Maps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ slug: string }>;

export default async function Image({ params }: { params: Params }) {
  const { slug } = await params;
  const [m] = await db
    .select({
      name: maps.name,
      version: maps.version,
      previewKey: maps.previewKey,
    })
    .from(maps)
    .where(eq(maps.slug, slug))
    .limit(1);

  if (!m) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a2342",
            color: "#e0b656",
            fontSize: 80,
          }}
        >
          Map not found
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0f1530",
        }}
      >
        {m.previewKey && (
          <img
            src={m.previewKey}
            alt=""
            width={630}
            height={630}
            style={{ objectFit: "cover" }}
          />
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 60,
            color: "#f3e3b8",
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#e0b656",
              textTransform: "uppercase",
              letterSpacing: 4,
              display: "flex",
            }}
          >
            {versionLabel(m.version)} · Heroic Maps
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#f3e3b8",
              display: "flex",
            }}
          >
            {m.name}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
