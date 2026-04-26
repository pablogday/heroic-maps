import { FACTION_COLOR, FACTION_LABEL, type Faction } from "@/lib/factions";

/**
 * Shield-shaped crest with a per-faction glyph. Pure SVG, scales cleanly,
 * matches the brass/parchment palette.
 */
export function FactionCrest({
  faction,
  size = 28,
  withLabel = false,
  className = "",
}: {
  faction: Faction;
  size?: number;
  withLabel?: boolean;
  className?: string;
}) {
  const accent = FACTION_COLOR[faction];
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={FACTION_LABEL[faction]}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 36"
        aria-hidden
        className="drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]"
      >
        {/* Shield body */}
        <path
          d="M2 3 L16 1 L30 3 L29 18 C 28 27, 22 32, 16 35 C 10 32, 4 27, 3 18 Z"
          fill="#1a2342"
          stroke="#b88a3a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner accent panel */}
        <path
          d="M5 6 L16 4.5 L27 6 L26.2 17.5 C 25.5 24.5, 21 28.5, 16 31 C 11 28.5, 6.5 24.5, 5.8 17.5 Z"
          fill={accent}
          opacity="0.85"
        />
        {/* Per-faction glyph */}
        <g transform="translate(16 17)" fill="#0e1428" stroke="#0e1428" strokeWidth="0.5">
          <Glyph faction={faction} />
        </g>
      </svg>
      {withLabel && (
        <span className="text-xs text-ink-soft">{FACTION_LABEL[faction]}</span>
      )}
    </span>
  );
}

/** Tiny glyphs centered on (0,0), roughly within a 16x16 box. */
function Glyph({ faction }: { faction: Faction }) {
  switch (faction) {
    case "castle": // cross-hilted sword
      return (
        <g>
          <rect x="-0.8" y="-7" width="1.6" height="14" />
          <rect x="-4" y="-4" width="8" height="1.6" />
        </g>
      );
    case "rampart": // tree
      return (
        <g>
          <rect x="-0.8" y="0" width="1.6" height="6" />
          <path d="M-5 -2 L0 -7 L5 -2 Z" />
          <path d="M-4 1 L0 -4 L4 1 Z" />
        </g>
      );
    case "tower": // tower silhouette
      return (
        <g>
          <rect x="-4" y="-2" width="8" height="8" />
          <rect x="-5" y="-3" width="10" height="2" />
          <rect x="-1" y="-7" width="2" height="5" />
          <path d="M-1 -7 L1 -7 L0 -9 Z" />
        </g>
      );
    case "inferno": // flame
      return (
        <path d="M0 -7 C -4 -2, -3 1, -2 4 C -3 5, -1 7, 0 6 C 1 7, 3 5, 2 4 C 3 1, 4 -2, 0 -7 Z" />
      );
    case "necropolis": // skull
      return (
        <g>
          <ellipse cx="0" cy="-1" rx="5" ry="5" />
          <rect x="-3" y="3" width="6" height="3" />
          <circle cx="-1.8" cy="-1" r="1" fill="#d8d8e0" stroke="none" />
          <circle cx="1.8" cy="-1" r="1" fill="#d8d8e0" stroke="none" />
        </g>
      );
    case "dungeon": // crown / dragon-jaw
      return (
        <g>
          <path d="M-5 4 L-5 -2 L-2 1 L0 -4 L2 1 L5 -2 L5 4 Z" />
          <rect x="-5" y="4" width="10" height="2" />
        </g>
      );
    case "stronghold": // axe
      return (
        <g>
          <rect x="-0.6" y="-7" width="1.2" height="14" />
          <path d="M0.6 -5 C 5 -5, 7 -3, 6 0 C 7 3, 5 5, 0.6 5 Z" />
        </g>
      );
    case "fortress": // wyvern wing / scale
      return (
        <g>
          <path d="M-6 -3 C -2 -6, 2 -6, 6 -3 C 4 0, 0 1, -6 -3 Z" />
          <path d="M-6 1 C -2 -2, 2 -2, 6 1 C 4 4, 0 5, -6 1 Z" />
        </g>
      );
    case "conflux": // 8-point star / orb
      return (
        <g>
          <circle cx="0" cy="0" r="2.5" />
          <path d="M0 -7 L0.8 -2 L0 0 L-0.8 -2 Z" />
          <path d="M0 7 L0.8 2 L0 0 L-0.8 2 Z" />
          <path d="M-7 0 L-2 -0.8 L0 0 L-2 0.8 Z" />
          <path d="M7 0 L2 -0.8 L0 0 L2 0.8 Z" />
        </g>
      );
  }
}
