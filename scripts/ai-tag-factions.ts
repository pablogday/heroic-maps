/**
 * Claude Haiku 4.5 pass that tags maps with the HoMM3 towns/factions
 * present, based on name + description.
 *
 * Far more accurate than the keyword backfill: Claude understands
 * paraphrasing ("undead lord" → necropolis), narrative context
 * ("you, a humble druid" → rampart), and disambiguates generic words
 * (e.g. "castle" the building vs "Castle" the faction).
 *
 * Cost shape (Haiku 4.5 @ $1/$5 per 1M tokens with prompt caching):
 *   - System prompt is large but cached, so most cost is the per-map
 *     user message + small JSON output.
 *   - 2,000 untagged maps ≈ ~$0.50–$1 total.
 *
 *   --dry         print decisions, don't write
 *   --limit=N     only process N maps (testing)
 *   --refine      ALSO re-tag maps that already have factions from
 *                 the keyword backfill (Claude usually does better)
 *   --rpm=N       requests per minute (default 45 to stay under free
 *                 tier's 50/min hard limit). Also caps concurrency.
 *
 * Confidence gating: we only persist tags when Claude reports
 * "high" or "medium" confidence; "low" results are logged and skipped.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { FACTIONS, type Faction } from "../src/lib/factions";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You identify which HoMM3 towns (factions) are present on a Heroes of Might and Magic 3 map, given its name and description.

The 9 factions:
- castle      — knights, paladins, griffins, angels, monks, archangels (good, lawful)
- rampart     — elves, dwarves, dendroids, unicorns, druids, green dragons (nature)
- tower       — wizards, gremlins, golems, mages, genies, nagas, titans (magic, snowy)
- inferno     — imps, demons, gogs, devils, efreet (chaos, fire)
- necropolis  — skeletons, zombies, vampires, liches, wights, dread knights, undead in general
- dungeon     — warlocks, troglodytes, beholders, medusas, minotaurs, manticores, black dragons
- stronghold  — barbarians, goblins, orcs, ogres, rocs, cyclops, behemoths
- fortress    — beastmasters, witches, gnolls, lizardmen, basilisks, gorgons, wyverns, hydras
- conflux     — elementalists, planeswalkers, elementals (fire/water/air/earth), magic elementals, phoenixes

Return a single JSON object, no other text:
{
  "factions": ["castle", "necropolis"],   // 0-9 codes from the list above
  "confidence": "high" | "medium" | "low"
}

Confidence rubric:
- "high"   — the description explicitly names units, heroes, or towns from the listed factions
- "medium" — strong contextual signals (e.g. "you raise the dead" → necropolis) but not explicit
- "low"    — only weak hints, or the description is too generic to tell

If the map description is too thin to make any inference, return an empty factions array with "low" confidence. Do not invent factions. Only list factions that have actual evidence.`;

type Args = {
  dry: boolean;
  limit?: number;
  refine: boolean;
  rpm: number;
};
function parseArgs(): Args {
  const a: Args = { dry: false, refine: false, rpm: 45 };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--refine") a.refine = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--rpm=")) a.rpm = Math.max(1, Number(arg.slice(6)));
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type MapRow = {
  id: number;
  name: string;
  description: string | null;
  version: string;
  factions: string[] | null;
};

type TagResult = {
  factions: Faction[];
  confidence: "high" | "medium" | "low";
};

function isFaction(x: unknown): x is Faction {
  return (
    typeof x === "string" && (FACTIONS as readonly string[]).includes(x)
  );
}

/** Extract a single JSON object from a possibly chatty model response. */
function parseTagResult(text: string): TagResult | null {
  // Pull the first {...} block — defensive in case the model wraps it.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[0]);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const factions = Array.isArray(obj.factions)
      ? obj.factions.filter(isFaction)
      : [];
    const confidence =
      obj.confidence === "high" ||
      obj.confidence === "medium" ||
      obj.confidence === "low"
        ? obj.confidence
        : "low";
    return { factions, confidence };
  } catch {
    return null;
  }
}

async function tagOne(
  client: Anthropic,
  m: MapRow
): Promise<{ result: TagResult; usage: Anthropic.Usage } | null> {
  const userMsg =
    `Map: ${m.name}\n` +
    `Version: ${m.version}\n\n` +
    `Description:\n${m.description?.trim() || "(no description)"}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const result = parseTagResult(text);
  if (!result) return null;
  return { result, usage: res.usage };
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const sql = postgres(url, { max: 1 });
  const client = new Anthropic({ apiKey });

  const maps = (await sql<MapRow[]>`
    SELECT id, name, description, version, factions
    FROM maps
    WHERE ${args.refine ? sql`true` : sql`factions IS NULL`}
    ORDER BY id ASC
    ${args.limit ? sql`LIMIT ${args.limit}` : sql``}
  `) as MapRow[];

  const intervalMs = Math.ceil(60_000 / args.rpm);
  console.log(
    `Tagging ${maps.length} maps · rpm=${args.rpm} (${intervalMs}ms/req) · dry=${args.dry} · refine=${args.refine}\n`
  );

  const stats = {
    high: 0,
    medium: 0,
    low: 0,
    failed: 0,
    cacheHits: 0,
    cacheWrites: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  let done = 0;
  for (const m of maps) {
    const startedAt = Date.now();
    try {
      const out = await tagOne(client, m);
      done++;
      if (!out) {
        stats.failed++;
        console.log(`[${done}/${maps.length}] ✗ ${m.name} — parse failed`);
      } else {
        stats[out.result.confidence]++;
        stats.inputTokens += out.usage.input_tokens;
        stats.outputTokens += out.usage.output_tokens;
        stats.cacheHits += out.usage.cache_read_input_tokens ?? 0;
        stats.cacheWrites += out.usage.cache_creation_input_tokens ?? 0;

        const tagsPretty = out.result.factions.length
          ? out.result.factions.join(", ")
          : "—";
        const symbol =
          out.result.confidence === "high"
            ? "✓"
            : out.result.confidence === "medium"
              ? "~"
              : "·";
        console.log(
          `[${done}/${maps.length}] ${symbol} [${out.result.confidence.padEnd(6)}] ${m.name}  →  ${tagsPretty}`
        );

        if (
          !args.dry &&
          (out.result.confidence === "high" ||
            out.result.confidence === "medium")
        ) {
          await sql`
            UPDATE maps
            SET factions = ${out.result.factions}, updated_at = now()
            WHERE id = ${m.id}
          `;
        }
      }
    } catch (e) {
      stats.failed++;
      done++;
      // 429s mean we're going too fast — back off significantly and
      // continue. Other errors just get logged.
      const isRateLimit = String(e).includes("429");
      console.error(
        `[${done}/${maps.length}] ✗ ${m.name} — ${isRateLimit ? "rate limited, backing off 60s" : e}`
      );
      if (isRateLimit) await sleep(60_000);
    }

    // Pace ourselves to stay under args.rpm.
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, intervalMs - elapsed);
    if (wait > 0) await sleep(wait);
  }

  console.log(
    `\nDone.` +
      ` high=${stats.high} medium=${stats.medium} low=${stats.low} failed=${stats.failed}` +
      `\nTokens: in=${stats.inputTokens.toLocaleString()} out=${stats.outputTokens.toLocaleString()}` +
      ` · cache_read=${stats.cacheHits.toLocaleString()} cache_write=${stats.cacheWrites.toLocaleString()}`
  );

  // Rough cost estimate (Haiku 4.5)
  const inCost = (stats.inputTokens / 1_000_000) * 1.0;
  const outCost = (stats.outputTokens / 1_000_000) * 5.0;
  const cacheReadCost = (stats.cacheHits / 1_000_000) * 0.1;
  const cacheWriteCost = (stats.cacheWrites / 1_000_000) * 1.25;
  const total = inCost + outCost + cacheReadCost + cacheWriteCost;
  console.log(`Approx cost: $${total.toFixed(4)}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
