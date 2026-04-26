/**
 * Generate AI summaries for maps with enough reviews.
 *
 * Strategy:
 *   - Pick maps where ratingCount >= MIN_REVIEWS and (no summary yet OR
 *     ratingCount has grown since last summary).
 *   - Send the current review set to Claude Haiku with a stable, cached
 *     system prompt so repeat runs hit the cache.
 *   - Store the summary plus the ratingCount snapshot it was based on.
 *
 * Run: npx tsx scripts/summarize-reviews.ts [--min=3] [--limit=20] [--dry]
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You summarize player reviews of Heroes of Might and Magic 3 fan-made maps for a community map browser.

Write 2–3 sentences (max ~60 words). Be concrete and specific to what reviewers actually said: mention recurring praise, recurring complaints, and the kind of player who'd enjoy it. Do not invent details, do not mention star ratings as numbers, do not start with the map name. Plain prose, no bullet points, no markdown, no quotes.

If reviews disagree, note the split briefly. If reviews are too thin or contentless, output exactly: INSUFFICIENT.`;

type Args = { min: number; limit: number; dry: boolean };

function parseArgs(): Args {
  const a: Args = { min: 3, limit: 20, dry: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg.startsWith("--min=")) a.min = Number(arg.slice(6));
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
  }
  return a;
}

async function main() {
  const args = parseArgs();

  const url = process.env.DATABASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!apiKey && !args.dry) throw new Error("ANTHROPIC_API_KEY not set");

  const sql = postgres(url, { max: 1 });
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  const candidates = await sql<
    { id: number; name: string; rating_count: number }[]
  >`
    SELECT id, name, rating_count
    FROM maps
    WHERE rating_count >= ${args.min}
      AND (ai_summary IS NULL OR ai_summary_review_count < rating_count)
    ORDER BY rating_count DESC
    LIMIT ${args.limit}
  `;

  console.log(`Found ${candidates.length} map(s) needing a summary.`);

  for (const m of candidates) {
    const reviews = await sql<{ rating: number; body: string | null }[]>`
      SELECT rating, body FROM reviews
      WHERE map_id = ${m.id}
      ORDER BY created_at ASC
    `;

    const formatted = reviews
      .map(
        (r, i) =>
          `Review ${i + 1} (${r.rating}/5): ${r.body?.trim() || "(no text)"}`
      )
      .join("\n\n");

    const userMsg = `Map: ${m.name}\n\n${formatted}`;

    if (args.dry) {
      console.log(`\n--- ${m.name} (${reviews.length} reviews) ---`);
      console.log(userMsg.slice(0, 400));
      continue;
    }

    const res = await client!.messages.create({
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

    const cacheRead = res.usage.cache_read_input_tokens ?? 0;
    const cacheWrite = res.usage.cache_creation_input_tokens ?? 0;
    console.log(
      `[${m.id}] ${m.name} — ${reviews.length} reviews — in:${res.usage.input_tokens} out:${res.usage.output_tokens} cache_r:${cacheRead} cache_w:${cacheWrite}`
    );

    if (text === "INSUFFICIENT" || !text) {
      console.log(`  -> skipped (model said INSUFFICIENT)`);
      continue;
    }

    console.log(`  -> ${text}`);

    await sql`
      UPDATE maps
      SET ai_summary = ${text},
          ai_summary_review_count = ${m.rating_count},
          updated_at = now()
      WHERE id = ${m.id}
    `;
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
