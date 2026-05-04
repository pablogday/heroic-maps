import { FACTION_COLOR, FACTION_LABEL, type Faction } from "@/lib/factions";

/**
 * Hand-drawn SVG town crest — original artwork that pairs with the
 * brass/parchment theme. Each faction has a layered glyph (silhouette
 * + accent) so it's recognizable at small sizes.
 *
 * Selected when the `factionCrestStyle()` flag is `svg`. The default
 * site renderer is `FactionCrestPixel` (real HoMM3 banner PNGs). Both
 * components share the same prop surface so the switcher in
 * `FactionCrest.tsx` can swap them transparently.
 */

const NATIVE_W = 32;
const NATIVE_H = 36;

export function FactionCrestSvg({
  faction,
  size = 28,
  fluid = false,
  withLabel = false,
  className = "",
}: {
  faction: Faction;
  size?: number;
  fluid?: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const accent = FACTION_COLOR[faction];
  // Match `FactionCrestPixel`'s contract: `size` is the rendered HEIGHT.
  // Width follows from the SVG's native viewBox aspect ratio so the
  // shield doesn't get squashed.
  const dim = fluid
    ? { width: "100%" as const, height: "auto" as const }
    : {
        width: Math.round((size * NATIVE_W) / NATIVE_H),
        height: size,
      };

  return (
    <span
      className={`${
        fluid ? "block w-full" : "inline-flex items-center gap-1.5"
      } ${className}`}
      title={FACTION_LABEL[faction]}
    >
      <svg
        {...dim}
        viewBox={`0 0 ${NATIVE_W} ${NATIVE_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        className="drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]"
      >
        <defs>
          {/* Vertical highlight on the inner panel so the crest looks
            * struck/embossed instead of flat. */}
          <linearGradient id={`hl-${faction}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Outer brass-trimmed shield. */}
        <path
          d="M2 3 L16 1 L30 3 L29 18 C 28 27, 22 32, 16 35 C 10 32, 4 27, 3 18 Z"
          fill="#1a2342"
          stroke="#b88a3a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner colored panel. */}
        <path
          d="M5 6 L16 4.5 L27 6 L26.2 17.5 C 25.5 24.5, 21 28.5, 16 31 C 11 28.5, 6.5 24.5, 5.8 17.5 Z"
          fill={accent}
          opacity="0.92"
        />
        {/* Embossed highlight overlay. */}
        <path
          d="M5 6 L16 4.5 L27 6 L26.2 17.5 C 25.5 24.5, 21 28.5, 16 31 C 11 28.5, 6.5 24.5, 5.8 17.5 Z"
          fill={`url(#hl-${faction})`}
        />

        {/* Per-faction glyph, centered roughly at (16, 17). */}
        <g transform="translate(16 17)">
          <Glyph faction={faction} />
        </g>
      </svg>
      {withLabel && !fluid && (
        <span className="text-xs text-ink-soft">{FACTION_LABEL[faction]}</span>
      )}
    </span>
  );
}

/**
 * The glyphs are deliberately simplified silhouettes — readable at
 * 18px, still appealing at 64px. Strokes are minimal because tiny
 * sizes blow out detail. Each one borrows a recognizable cue from the
 * faction's in-game iconography.
 */
function Glyph({ faction }: { faction: Faction }) {
  const ink = "#0e1428";
  const ivory = "#f6efd8";

  switch (faction) {
    case "castle":
      // Cross-hilted longsword with pommel — the Castle banner motif.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* blade */}
          <path d="M-0.9 -8 L0.9 -8 L1 4 L-1 4 Z" />
          {/* tip highlight */}
          <path d="M-0.9 -8 L0.9 -8 L0.4 -7 L-0.4 -7 Z" fill={ivory} />
          {/* cross-guard */}
          <rect x="-4.5" y="-2.6" width="9" height="1.8" rx="0.4" />
          {/* grip */}
          <rect x="-0.7" y="4" width="1.4" height="3" />
          {/* pommel */}
          <circle cx="0" cy="7.6" r="1.2" />
          {/* tiny gem on the cross-guard */}
          <circle cx="0" cy="-1.7" r="0.5" fill={ivory} />
        </g>
      );

    case "rampart":
      // Layered evergreen — Rampart's elven-forest cue.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* trunk */}
          <rect x="-0.9" y="3" width="1.8" height="4" />
          {/* three canopy tiers, top to bottom */}
          <path d="M-3.5 -4 L0 -8 L3.5 -4 Z" />
          <path d="M-4.5 -1 L0 -6 L4.5 -1 Z" />
          <path d="M-5.5 3 L0 -3 L5.5 3 Z" />
          {/* highlight droplets */}
          <circle cx="-1.6" cy="-1" r="0.4" fill={ivory} />
          <circle cx="1.4" cy="1.2" r="0.4" fill={ivory} />
        </g>
      );

    case "tower":
      // Crenellated tower with a star above (gremlin/genie magic cue).
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* main shaft */}
          <rect x="-3.2" y="-2" width="6.4" height="9" />
          {/* battlements */}
          <rect x="-4" y="-3.5" width="1.6" height="1.8" />
          <rect x="-1.2" y="-3.5" width="2.4" height="1.8" />
          <rect x="2.4" y="-3.5" width="1.6" height="1.8" />
          {/* arched door */}
          <path
            d="M-1.4 7 L-1.4 4 C -1.4 2.5, 1.4 2.5, 1.4 4 L1.4 7 Z"
            fill={ivory}
          />
          {/* magic star drifting above */}
          <path d="M0 -7 L0.6 -5.6 L2 -5.4 L0.9 -4.5 L1.2 -3.1 L0 -3.8 L-1.2 -3.1 L-0.9 -4.5 L-2 -5.4 L-0.6 -5.6 Z" />
        </g>
      );

    case "inferno":
      // Tall flame with an inner ember.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* outer flame */}
          <path
            d="M0 -8
               C -3.5 -3, -4.5 0, -3 3.5
               C -3.5 5, -1.5 7.5, 0 6.5
               C 1.5 7.5, 3.5 5, 3 3.5
               C 4.5 0, 3.5 -3, 0 -8 Z"
          />
          {/* ember */}
          <path
            d="M0 -3.5 C -1.6 -0.5, -1.6 2, 0 4 C 1.6 2, 1.6 -0.5, 0 -3.5 Z"
            fill={ivory}
          />
          {/* base sparks */}
          <circle cx="-3" cy="6.5" r="0.6" />
          <circle cx="3" cy="6.5" r="0.6" />
        </g>
      );

    case "necropolis":
      // Skull with eye sockets and a jaw line.
      return (
        <g fill={ivory} stroke={ink} strokeLinejoin="round" strokeWidth="0.5">
          {/* cranium */}
          <path d="M-5 -1.5 C -5 -7, 5 -7, 5 -1.5 L5 2.2 C 5 3, 4 3.5, 3.4 3.5 L-3.4 3.5 C -4 3.5, -5 3, -5 2.2 Z" />
          {/* nasal cavity */}
          <path d="M-0.6 0 L0.6 0 L0 2 Z" fill={ink} stroke="none" />
          {/* sockets */}
          <ellipse cx="-2.2" cy="-1.5" rx="1.4" ry="1.7" fill={ink} stroke="none" />
          <ellipse cx="2.2" cy="-1.5" rx="1.4" ry="1.7" fill={ink} stroke="none" />
          {/* jaw teeth */}
          <rect x="-3" y="3.5" width="6" height="2.5" />
          <line x1="-1.6" y1="3.5" x2="-1.6" y2="6" stroke={ink} strokeWidth="0.4" />
          <line x1="0" y1="3.5" x2="0" y2="6" stroke={ink} strokeWidth="0.4" />
          <line x1="1.6" y1="3.5" x2="1.6" y2="6" stroke={ink} strokeWidth="0.4" />
        </g>
      );

    case "dungeon":
      // Three-prong crown with set gem — Dungeon's overlord cue.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* base band */}
          <rect x="-5.5" y="3" width="11" height="2.5" />
          {/* three peaks */}
          <path d="M-5.5 3 L-5.5 -3 L-3 0 L-1 -5 L0 -1 L1 -5 L3 0 L5.5 -3 L5.5 3 Z" />
          {/* gem */}
          <path d="M-1.2 -0.5 L0 -2.3 L1.2 -0.5 L0 1.3 Z" fill={ivory} />
        </g>
      );

    case "stronghold":
      // Battle-axe with curved bit and bound haft.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* haft */}
          <rect x="-0.8" y="-7" width="1.6" height="14" />
          {/* axe head */}
          <path d="M0.8 -5 C 5.5 -5.5, 7.5 -3, 6.5 0 C 7.5 3, 5.5 5.5, 0.8 5 Z" />
          {/* edge highlight */}
          <path
            d="M0.8 -5 C 5.5 -5.5, 7.5 -3, 6.5 0 L4.5 0 C 5 -2, 4 -3.5, 0.8 -3.2 Z"
            fill={ivory}
            opacity="0.35"
          />
          {/* haft bindings */}
          <rect x="-1.2" y="-3" width="2.4" height="0.8" />
          <rect x="-1.2" y="0" width="2.4" height="0.8" />
          <rect x="-1.2" y="3" width="2.4" height="0.8" />
        </g>
      );

    case "fortress":
      // Reptilian eye with vertical pupil — Fortress's lizardfolk cue.
      return (
        <g stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* outer almond */}
          <path
            d="M-7 0 C -4 -4.5, 4 -4.5, 7 0 C 4 4.5, -4 4.5, -7 0 Z"
            fill={ivory}
          />
          {/* iris */}
          <ellipse cx="0" cy="0" rx="3" ry="3" fill={ink} stroke="none" />
          {/* slit pupil */}
          <ellipse cx="0" cy="0" rx="0.6" ry="2.6" fill={ivory} stroke="none" />
          {/* glint */}
          <circle cx="-1" cy="-0.8" r="0.5" fill={ivory} stroke="none" />
        </g>
      );

    case "conflux":
      // Eight-rayed star around an orb — elemental plane cue.
      return (
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeWidth="0.4">
          {/* four cardinal rays */}
          <path d="M0 -8 L0.9 -2 L0 0 L-0.9 -2 Z" />
          <path d="M0 8 L0.9 2 L0 0 L-0.9 2 Z" />
          <path d="M-8 0 L-2 -0.9 L0 0 L-2 0.9 Z" />
          <path d="M8 0 L2 -0.9 L0 0 L2 0.9 Z" />
          {/* four diagonal rays */}
          <path
            d="M-5.6 -5.6 L-1.6 -0.8 L0 0 L-0.8 -1.6 Z"
            opacity="0.7"
          />
          <path
            d="M5.6 5.6 L1.6 0.8 L0 0 L0.8 1.6 Z"
            opacity="0.7"
          />
          <path
            d="M-5.6 5.6 L-1.6 0.8 L0 0 L-0.8 1.6 Z"
            opacity="0.7"
          />
          <path
            d="M5.6 -5.6 L1.6 -0.8 L0 0 L0.8 -1.6 Z"
            opacity="0.7"
          />
          {/* central orb */}
          <circle cx="0" cy="0" r="2.2" fill={ivory} />
          <circle cx="0" cy="0" r="1.1" fill={ink} />
        </g>
      );
  }
}
