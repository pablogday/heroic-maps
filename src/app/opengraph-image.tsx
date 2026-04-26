import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Heroic Maps — HoMM3 map browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(180deg, #1a2342 0%, #0f1530 100%)",
          color: "#f3e3b8",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#e0b656",
            letterSpacing: "-2px",
            display: "flex",
          }}
        >
          Heroic Maps
        </div>
        <div
          style={{
            fontSize: 40,
            marginTop: 20,
            color: "#d8c79a",
            display: "flex",
          }}
        >
          A modern home for HoMM3 maps
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 24,
            color: "#a89770",
            display: "flex",
            gap: 24,
          }}
        >
          <span>SoD</span>
          <span>·</span>
          <span>HotA</span>
          <span>·</span>
          <span>WoG</span>
          <span>·</span>
          <span>Chronicles</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
