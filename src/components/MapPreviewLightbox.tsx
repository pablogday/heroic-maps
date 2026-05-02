"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Preview {
  url: string;
  label: "Surface" | "Underground";
}

/**
 * Fullscreen viewer for map previews. Wheel/pinch to zoom, drag to pan,
 * double-click to reset. Surface/Underground tabs when both layers are
 * present. Click outside or hit ESC to close.
 */
export function MapPreviewLightbox({
  previews,
  initialLayer = "Surface",
  open,
  onClose,
  mapName,
}: {
  previews: Preview[];
  initialLayer?: "Surface" | "Underground";
  open: boolean;
  onClose: () => void;
  mapName: string;
}) {
  const [layer, setLayer] = useState<"Surface" | "Underground">(initialLayer);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset zoom/pan whenever opened or layer toggled.
  useEffect(() => {
    if (open) {
      setScale(1);
      setTx(0);
      setTy(0);
      setLayer(initialLayer);
    }
  }, [open, initialLayer]);

  // ESC to close + lock body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (previews.length > 1) {
          setLayer((l) => (l === "Surface" ? "Underground" : "Surface"));
        }
      }
      if (e.key === "0") {
        setScale(1);
        setTx(0);
        setTy(0);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, previews.length]);

  if (!mounted || !open) return null;

  const current = previews.find((p) => p.label === layer) ?? previews[0];
  if (!current) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setScale((s) => Math.max(0.5, Math.min(8, s * (1 + delta))));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX - tx, y: e.clientY - ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setTx(e.clientX - dragRef.current.x);
    setTy(e.clientY - dragRef.current.y);
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };
  const onDoubleClick = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mapName} — fullscreen preview`}
      className="fixed inset-0 z-[100] flex flex-col bg-night-deep/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar: title + tabs + close */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-brass/30 bg-night-deep/70 px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-sm text-parchment/90">
          {mapName} — {current.label}
        </div>
        <div className="flex items-center gap-2">
          {previews.length > 1 && (
            <div className="inline-flex overflow-hidden rounded border border-brass/40">
              {previews.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setLayer(p.label)}
                  className={`px-3 py-1 text-xs font-display uppercase tracking-wider transition-colors ${
                    p.label === layer
                      ? "bg-brass/30 text-parchment"
                      : "text-parchment/70 hover:bg-brass/15"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setTx(0);
              setTy(0);
            }}
            className="rounded border border-brass/40 px-2 py-1 text-xs text-parchment/80 hover:bg-brass/15"
            title="Reset zoom (0)"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-brass/40 px-3 py-1 text-sm text-parchment hover:bg-brass/15"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image canvas */}
      <div
        className="relative flex-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        style={{
          cursor: dragRef.current ? "grabbing" : scale > 1 ? "grab" : "zoom-in",
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: dragRef.current ? "none" : "transform 120ms ease-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`${mapName} — ${current.label}`}
            className="max-h-[85vh] max-w-[90vw] select-none pixelated"
            draggable={false}
          />
        </div>
      </div>

      {/* Bottom hint */}
      <div
        className="border-t border-brass/30 bg-night-deep/70 px-5 py-2 text-center text-xs text-parchment/60"
        onClick={(e) => e.stopPropagation()}
      >
        Scroll to zoom · Drag to pan · Double-click to reset · ESC to close
        {previews.length > 1 && " · ← → to switch layers"}
      </div>
    </div>,
    document.body
  );
}
