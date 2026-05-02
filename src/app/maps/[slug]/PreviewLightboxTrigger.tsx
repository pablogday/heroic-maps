"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPreviewLightbox } from "@/components/MapPreviewLightbox";

/**
 * Wraps the surface + (optional) underground preview images. Clicking
 * either opens a fullscreen zoom/pan viewer.
 */
export function PreviewLightboxTrigger({
  mapName,
  surfaceUrl,
  undergroundUrl,
}: {
  mapName: string;
  surfaceUrl: string;
  undergroundUrl: string | null;
}) {
  const [openLayer, setOpenLayer] = useState<"Surface" | "Underground" | null>(
    null
  );

  const previews: Array<{ url: string; label: "Surface" | "Underground" }> = [
    { url: surfaceUrl, label: "Surface" },
  ];
  if (undergroundUrl) {
    previews.push({ url: undergroundUrl, label: "Underground" });
  }

  return (
    <>
      <div
        className={`hidden sm:grid sm:gap-4 ${
          undergroundUrl ? "sm:grid-cols-2" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setOpenLayer("Surface")}
          className="card-brass group overflow-hidden rounded text-left"
          title="Click to view fullscreen"
        >
          <div className="border-b border-brass/40 bg-night-deep px-4 py-2 text-xs uppercase tracking-wider text-parchment/80">
            Surface
            <span className="float-right opacity-0 transition-opacity group-hover:opacity-100">
              ⤢
            </span>
          </div>
          <div className="relative aspect-square w-full bg-night-deep">
            <Image
              src={surfaceUrl}
              alt={`${mapName} — surface map`}
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-contain pixelated"
              unoptimized
              priority
            />
          </div>
        </button>
        {undergroundUrl && (
          <button
            type="button"
            onClick={() => setOpenLayer("Underground")}
            className="card-brass group overflow-hidden rounded text-left"
            title="Click to view fullscreen"
          >
            <div className="border-b border-brass/40 bg-night-deep px-4 py-2 text-xs uppercase tracking-wider text-parchment/80">
              Underground
              <span className="float-right opacity-0 transition-opacity group-hover:opacity-100">
                ⤢
              </span>
            </div>
            <div className="relative aspect-square w-full bg-night-deep">
              <Image
                src={undergroundUrl}
                alt={`${mapName} — underground map`}
                fill
                sizes="(max-width: 1024px) 50vw, 33vw"
                className="object-contain pixelated"
                unoptimized
              />
            </div>
          </button>
        )}
      </div>

      <MapPreviewLightbox
        mapName={mapName}
        previews={previews}
        initialLayer={openLayer ?? "Surface"}
        open={openLayer !== null}
        onClose={() => setOpenLayer(null)}
      />
    </>
  );
}
