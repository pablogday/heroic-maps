import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { maps, reviews } from "@/db/schema";
import { REVIEW_SUMMARY_SYSTEM } from "@/lib/ai-prompts";

/**
 * Daily-scheduled review summary job. Runs the same Claude Haiku 4.5
 * pass that `scripts/summarize-reviews.ts` does, but as a Vercel
 * cron-triggered HTTP endpoint.
 *
 * Picks up to PER_RUN maps that:
 *   - have at least MIN_REVIEWS reviews, AND
 *   - have either no summary yet, or a stale summary
 *     (its `aiSummaryReviewCount` is below the current `ratingCount`)
 *
 * Sorted so the most-reviewed stale maps are summarized first. Vercel
 * Hobby allows daily granularity — for a hobby site that's plenty.
 *
 * Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` when calling
 * scheduled cron paths, so we reject anything else (random GETs from
 * the public internet, link previews, etc).
 */

export const runtime = "nodejs";
// Vercel Hobby caps function execution at 60s. Per-map calls take
// 1–3 seconds typically; PER_RUN=5 leaves comfortable headroom.
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";
const MIN_REVIEWS = 3;
const PER_RUN = 5;

export async function GET(req: Request) {
  // Reject anything not coming from Vercel's cron infra.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  const candidates = await db
    .select({
      id: maps.id,
      name: maps.name,
      ratingCount: maps.ratingCount,
    })
    .from(maps)
    .where(
      and(
        gte(maps.ratingCount, MIN_REVIEWS),
        or(
          isNull(maps.aiSummary),
          sql`${maps.aiSummaryReviewCount} < ${maps.ratingCount}`
        )
      )
    )
    .orderBy(sql`${maps.ratingCount} DESC`)
    .limit(PER_RUN);

  if (candidates.length === 0) {
    return NextResponse.json({ processed: 0, message: "nothing stale" });
  }

  const client = new Anthropic({ apiKey });

  const results: { id: number; name: string; status: string }[] = [];

  for (const m of candidates) {
    try {
      const rs = await db
        .select({ rating: reviews.rating, body: reviews.body })
        .from(reviews)
        .where(eq(reviews.mapId, m.id))
        .orderBy(asc(reviews.createdAt));

      const formatted = rs
        .map(
          (r, i) =>
            `Review ${i + 1} (${r.rating}/5): ${r.body?.trim() || "(no text)"}`
        )
        .join("\n\n");

      const userMsg = `Map: ${m.name}\n\n${formatted}`;

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        system: [
          {
            type: "text",
            text: REVIEW_SUMMARY_SYSTEM,
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

      if (text === "INSUFFICIENT" || !text) {
        results.push({ id: m.id, name: m.name, status: "insufficient" });
        continue;
      }

      await db
        .update(maps)
        .set({
          aiSummary: text,
          aiSummaryReviewCount: m.ratingCount,
          updatedAt: new Date(),
        })
        .where(eq(maps.id, m.id));

      results.push({ id: m.id, name: m.name, status: "summarized" });
    } catch (e) {
      results.push({
        id: m.id,
        name: m.name,
        status: `error: ${(e as Error).message}`,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
