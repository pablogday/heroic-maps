import { StatIcon, type IconName } from "./StatIcon";
import { SIZE_LABEL, type Size } from "@/lib/map-constants";

const DIFFICULTY_LEVEL: Record<string, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
  expert: 4,
  impossible: 5,
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  expert: "Expert",
  impossible: "Impossible",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-emerald-700",
  normal: "text-amber-700",
  hard: "text-orange-700",
  expert: "text-red-700",
  impossible: "text-fuchsia-800",
};

export function MapStats({
  size,
  difficulty,
  totalPlayers,
  humanPlayers,
  aiPlayers,
  teamCount,
  hasUnderground,
}: {
  size: string;
  difficulty: string | null;
  totalPlayers: number;
  humanPlayers: number;
  aiPlayers: number;
  teamCount: number | null;
  hasUnderground: boolean;
}) {
  return (
    <div className="card-brass rounded p-5">
      <h3 className="mb-4 font-display text-sm uppercase tracking-[0.15em] text-ink-soft">
        Specs
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Tile icon="size" label="Size" value={SIZE_LABEL[size as Size]} />
        <DifficultyTile difficulty={difficulty} />
        <PlayersTile
          total={totalPlayers}
          human={humanPlayers}
          ai={aiPlayers}
        />
        <UndergroundTile has={hasUnderground} />
      </div>

      {teamCount != null && teamCount > 0 && (
        <div className="mt-3 flex items-center justify-between rounded border border-brass/30 bg-parchment-dark/30 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-ink-soft">
            <StatIcon name="teams" />
            Teams
          </span>
          <span className="font-display text-base text-ink">{teamCount}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- tiles ---------- */

function Tile({
  icon,
  label,
  value,
  children,
}: {
  icon: IconName;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-brass/30 bg-parchment-dark/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-soft/80">
        <StatIcon name={icon} size={12} />
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg leading-none text-ink">
        {value}
        {children}
      </div>
    </div>
  );
}

function DifficultyTile({ difficulty }: { difficulty: string | null }) {
  const level = difficulty ? DIFFICULTY_LEVEL[difficulty] ?? 0 : 0;
  const label = difficulty
    ? DIFFICULTY_LABEL[difficulty] ?? difficulty
    : "—";
  const color = difficulty
    ? DIFFICULTY_COLOR[difficulty] ?? "text-ink"
    : "text-ink";
  return (
    <Tile icon="difficulty" label="Difficulty">
      <div className={`flex items-center justify-between gap-2 ${color}`}>
        <span>{label}</span>
        <span aria-hidden className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`inline-block h-2 w-2 rotate-45 ${
                i < level ? "bg-current" : "bg-current/15"
              }`}
            />
          ))}
        </span>
      </div>
    </Tile>
  );
}

function PlayersTile({
  total,
  human,
  ai,
}: {
  total: number;
  human: number;
  ai: number;
}) {
  return (
    <Tile icon="players" label="Players">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl leading-none">{total}</span>
        <span className="text-[11px] text-ink-soft">
          <span className="text-ink">{human}</span>H ·{" "}
          <span className="text-ink">{ai}</span>AI
        </span>
      </div>
    </Tile>
  );
}

function UndergroundTile({ has }: { has: boolean }) {
  return (
    <Tile icon="underground" label="Underground">
      <span className={has ? "text-blood" : "text-ink-soft"}>
        {has ? "Yes" : "No"}
      </span>
    </Tile>
  );
}
