/**
 * AI-augmented series detection. Builds candidate clusters from loose
 * name-prefix similarity, then asks Claude Haiku to validate each one
 * and pick a series kind + assign positions where applicable.
 *
 * Why AI: the heuristic detector only matches *exact* normalized
 * stems (so "Erathia I" / "Erathia II" → series, but "Erathia: The
 * Beginning" / "Return to Erathia" → missed). The AI sees names +
 * descriptions and can recognize themed groupings the regex can't.
 *
 *   --dry            print decisions, no DB writes
 *   --limit=N        max candidate clusters to process (default unlimited)
 *   --min-size=N     min cluster size for AI validation (default 2)
 *   --max-size=N     max cluster size — drop noisy super-clusters (default 12)
 *   --concurrency=N  parallel Claude calls (default 4)
 *
 * Cost: each cluster is ~600 tokens in / ~120 out at Haiku rates,
 * roughly $0.001/cluster. For ~500-1000 candidates ≈ $1-3 total.
 * Run --dry first; commit the candidates list and verify.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-haiku-4-5";

// ---------- args ----------
type Args = {
  dry: boolean;
  limit: number | null;
  minSize: number;
  maxSize: number;
  concurrency: number;
};
function parseArgs(): Args {
  const a: Args = {
    dry: false,
    limit: null,
    minSize: 2,
    maxSize: 12,
    concurrency: 3,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--min-size=")) a.minSize = Number(arg.slice(11));
    else if (arg.startsWith("--max-size=")) a.maxSize = Number(arg.slice(11));
    else if (arg.startsWith("--concurrency="))
      a.concurrency = Number(arg.slice(14));
  }
  return a;
}

// ---------- token-based candidate clustering ----------

// Words that are too common to anchor a series on. Adding "campaign"
// because community uses it as decoration too.
const STOP = new Set([
  "the", "of", "a", "an", "and", "or", "to", "in", "for", "on", "by",
  "is", "it", "as", "at", "from", "with", "into", "vs",
  "map", "maps", "game", "campaign", "scenario", "story", "tale", "tales",
  "world", "land", "lands", "kingdom", "realm", "realms", "saga",
  "version", "edition", "remake", "remix", "remaster", "remastered",
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
]);

/** Normalize a map name for tokenization. Strips parens, version/era
 * markers, trailing numerals, and lowercases. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:era\s+edition|hota|wog|sod|ab|roe)\b/g, " ")
    .replace(/\bv?\d+(?:\.\d+)+\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Cluster maps sharing the same first-2 significant tokens. This
 * catches "Erathia I", "Erathia II", "Erathia III" without needing
 * the suffix to be a numeral the heuristic recognized. */
function clusterByPrefix<T extends { id: number; name: string }>(
  maps: T[],
  size: { min: number; max: number }
): Array<{ key: string; members: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const m of maps) {
    const t = tokens(m.name);
    if (t.length < 2) continue;
    const key = `${t[0]}|${t[1]}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(m);
    buckets.set(key, bucket);
  }
  const out: Array<{ key: string; members: T[] }> = [];
  for (const [key, members] of buckets) {
    if (members.length < size.min || members.length > size.max) continue;
    out.push({ key, members });
  }
  return out;
}

// ---------- Claude validation ----------

const ClusterDecision = z.object({
  isSeries: z
    .boolean()
    .describe(
      "True only if the maps are clearly a related set: numbered sequels, story arc, themed remakes, language variants, or difficulty variants."
    ),
  kind: z
    .enum(["sequel", "variant", "remake"])
    .nullable()
    .describe(
      "sequel = numbered story-progression maps (Part 1, Part 2). variant = same map with difficulty/language/edition tags. remake = same map updated/re-released. Null when isSeries is false."
    ),
  seriesName: z
    .string()
    .nullable()
    .describe("Human-readable series name (no Roman numerals or suffixes). Null when isSeries is false."),
  members: z
    .array(
      z.object({
        id: z.number(),
        position: z
          .number()
          .nullable()
          .describe("1-based order in a sequel series; null for variants/remakes or when ambiguous."),
      })
    )
    .describe("Subset of input maps that genuinely belong to this series. Drop outliers."),
});
type ClusterDecisionT = z.infer<typeof ClusterDecision>;

const SYSTEM = `You are validating candidate map series for a Heroes of Might and Magic 3 fan-map archive.

A series is a deliberate set of maps that belong together — multi-part stories, difficulty variants, language variants, or remakes. Maps that just happen to share a word are NOT a series; reject those.

Be conservative. When unsure, return isSeries=false. Better to miss a real series than invent one.

Output strictly via the provided schema.`;

function buildUserMessage(members: Array<{
  id: number;
  name: string;
  description: string | null;
  version: string;
  factions: string[] | null;
}>): string {
  const lines = members.map((m) => {
    const desc = (m.description ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
    const fact = m.factions && m.factions.length > 0 ? ` [${m.factions.join(", ")}]` : "";
    return `- id=${m.id} ${m.version}${fact}: "${m.name}"${desc ? `\n    ${desc}` : ""}`;
  });
  return `Candidate cluster (${members.length} maps):\n${lines.join("\n")}`;
}

// ---------- main ----------

interface MapRow {
  id: number;
  name: string;
  description: string | null;
  version: string;
  factions: string[] | null;
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!apiKey && !args.dry) throw new Error("ANTHROPIC_API_KEY not set");

  const sql = postgres(url, { max: 4 });
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  try {
    const maps = (await sql`
      SELECT id, name, description, version, factions
      FROM maps
      WHERE series_id IS NULL
    `) as MapRow[];
    console.log(`Loaded ${maps.length} unassigned maps.`);

    let clusters = clusterByPrefix(maps, {
      min: args.minSize,
      max: args.maxSize,
    });
    console.log(
      `Built ${clusters.length} candidate clusters (size ${args.minSize}..${args.maxSize}).`
    );
    if (args.limit !== null) {
      clusters = clusters.slice(0, args.limit);
      console.log(`Limited to first ${clusters.length}.`);
    }

    if (args.dry) {
      console.log("\nFirst 12 candidate clusters:");
      for (const c of clusters.slice(0, 12)) {
        console.log(`  [${c.key}] ${c.members.length} maps:`);
        for (const m of c.members) console.log(`     ${m.id}  ${m.name}`);
      }
      console.log("\n--dry: stopping before AI calls.");
      return;
    }

    const limiter = pLimit(args.concurrency);
    const results: Array<{ cluster: { key: string; members: MapRow[] }; decision: ClusterDecisionT }> = [];
    let processed = 0;
    let realSeries = 0;

    await Promise.all(
      clusters.map((c) =>
        limiter(async () => {
          try {
            const userMsg = buildUserMessage(c.members);
            const decision = await callWithRetry(client!, userMsg);
            if (decision && decision.isSeries && decision.members.length >= 2) {
              results.push({ cluster: c, decision });
              realSeries++;
            }
          } catch (e) {
            console.error(
              `cluster [${c.key}] failed after retries:`,
              e instanceof Error ? e.message : e
            );
          } finally {
            processed++;
            if (processed % 20 === 0) {
              console.log(
                `  …${processed}/${clusters.length} (${realSeries} accepted)`
              );
            }
          }
        })
      )
    );

    console.log(
      `\nDone. ${realSeries} clusters validated as series out of ${clusters.length} candidates.`
    );

    // Write to DB
    let written = 0;
    let mapsTagged = 0;
    for (const { cluster, decision } of results) {
      // Sanity: only members the AI confirmed belong, intersected with input.
      const inputIds = new Set(cluster.members.map((m) => m.id));
      const confirmed = decision.members.filter((m) => inputIds.has(m.id));
      if (confirmed.length < 2) continue;

      const seriesName = decision.seriesName?.trim() || cluster.key.replace("|", " ");
      const seriesSlug = slugify(seriesName);

      const inserted = await sql`
        INSERT INTO map_series (slug, name, kind)
        VALUES (${seriesSlug}, ${seriesName}, ${decision.kind ?? "sequel"})
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      ` as Array<{ id: number }>;
      const seriesId = inserted[0].id;

      for (const m of confirmed) {
        await sql`
          UPDATE maps
          SET series_id = ${seriesId}, series_position = ${m.position}
          WHERE id = ${m.id} AND series_id IS NULL
        `;
        mapsTagged++;
      }
      written++;
    }

    console.log(`\nWrote ${written} new series, tagged ${mapsTagged} maps.`);
  } finally {
    await sql.end();
  }
}

/** Tiny wrapper around `messages.parse` with backoff for 429s.
 * Anthropic's free-tier limit is 50 RPM / 50k input TPM, so a few
 * retries with jitter are enough to ride out a burst. */
async function callWithRetry(
  client: Anthropic,
  userMsg: string,
  maxAttempts = 5
): Promise<ClusterDecisionT | null> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    try {
      const resp = await client.messages.parse({
        model: MODEL,
        max_tokens: 800,
        system: [
          {
            type: "text",
            text: SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMsg }],
        output_config: { format: zodOutputFormat(ClusterDecision) },
      });
      return resp.parsed_output as ClusterDecisionT | null;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const is429 = msg.includes("429") || msg.includes("rate_limit");
      if (!is429) throw e;
      attempt++;
      const baseMs = 4000 * 2 ** (attempt - 1); // 4, 8, 16, 32, 64s
      const jitterMs = Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, baseMs + jitterMs));
    }
  }
  throw lastErr;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
