/**
 * Campaign archive block — shown on the detail page when the map's
 * file is a `.h3c` (multi-scenario campaign) instead of a single map.
 *
 * The data is parsed by `src/lib/h3c` and stored in
 * `maps.campaign_data` JSONB. We render the scenario list as a chunky
 * numbered roster with prologue/epilogue snippets when available.
 */
const DIFFICULTY_LABELS = ["Easy", "Normal", "Hard", "Expert", "Impossible"];

const REGION_COLORS = [
  "#dc2626", // red
  "#2563eb", // blue
  "#a16207", // tan
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
  "#0891b2", // teal
  "#db2777", // pink
];

interface CampaignScenarioPayload {
  mapName?: string;
  regionColor?: number;
  difficulty?: number;
  regionText?: string;
  prologText?: string;
  epilogText?: string;
}

interface CampaignDataPayload {
  version?: string;
  scenarioCount?: number;
  scenarios?: CampaignScenarioPayload[];
  parserError?: string | null;
}

export function CampaignBlock({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const c = data as CampaignDataPayload;
  const scenarios = c.scenarios ?? [];
  const total = c.scenarioCount ?? scenarios.length;

  return (
    <section className="card-brass mt-4 rounded p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-ink">Campaign</h2>
        <span className="text-xs uppercase tracking-wide text-ink-soft">
          {c.version ?? "?"} · {total} scenario{total === 1 ? "" : "s"}
        </span>
      </div>

      {scenarios.length === 0 ? (
        <p className="text-sm italic text-ink-soft">
          {c.parserError
            ? `This is a campaign archive, but its scenario list couldn't be decoded: ${c.parserError}`
            : "This is a campaign archive. The scenario list isn't available for this file."}
        </p>
      ) : (
        <ol className="space-y-3">
          {scenarios.map((s, i) => {
            const color =
              s.regionColor != null && s.regionColor < REGION_COLORS.length
                ? REGION_COLORS[s.regionColor]
                : "#a16207";
            const difficulty =
              s.difficulty != null && s.difficulty < DIFFICULTY_LABELS.length
                ? DIFFICULTY_LABELS[s.difficulty]
                : null;
            const region = s.regionText ? s.regionText : "";
            const prolog = s.prologText ? s.prologText : "";
            const epilog = s.epilogText ? s.epilogText : "";
            const display = filenameToTitle(s.mapName ?? `Scenario ${i + 1}`);
            return (
              <li
                key={i}
                className="flex gap-3 rounded border border-brass/30 bg-parchment/40 p-3"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full font-display text-sm text-parchment shadow-inner"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-base text-ink">
                      {display}
                    </span>
                    {difficulty && (
                      <span className="rounded border border-brass/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">
                        {difficulty}
                      </span>
                    )}
                  </div>
                  {region && (
                    <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                      {region}
                    </p>
                  )}
                  {(prolog || epilog) && (
                    <div className="mt-2 space-y-1 text-xs text-ink-soft/80">
                      {prolog && (
                        <p className="line-clamp-2 italic">
                          <span className="font-display not-italic uppercase tracking-wide text-ink-soft/60">
                            Prologue —{" "}
                          </span>
                          {prolog}
                        </p>
                      )}
                      {epilog && (
                        <p className="line-clamp-2 italic">
                          <span className="font-display not-italic uppercase tracking-wide text-ink-soft/60">
                            Epilogue —{" "}
                          </span>
                          {epilog}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** "Lord_Haart_pl.h3m" → "Lord Haart pl". Strips extension and the
 * underscores so we don't show the raw filename verbatim. */
function filenameToTitle(name: string): string {
  return name
    .replace(/\.h3m$/i, "")
    .replace(/[_]+/g, " ")
    .trim();
}
