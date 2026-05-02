"use server";

import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { VERSIONS, SIZES, DIFFICULTIES } from "@/lib/map-constants";
import { FACTIONS } from "@/lib/factions";

const SmartFilters = z.object({
  q: z
    .string()
    .nullable()
    .describe(
      "Free-text search over the map name when the query mentions a specific name. Null otherwise."
    ),
  version: z.enum(VERSIONS).nullable().describe("HoMM3 expansion / version."),
  size: z.enum(SIZES).nullable().describe("Map size code."),
  faction: z
    .enum(FACTIONS)
    .nullable()
    .describe(
      "A single faction the user wants to play or that the map should feature."
    ),
  difficulty: z.enum(DIFFICULTIES).nullable().describe("Difficulty level."),
  players: z
    .number()
    .int()
    .min(1)
    .max(8)
    .nullable()
    .describe(
      "Total number of human-playable slots the user wants. Null when unspecified."
    ),
  underground: z
    .enum(["yes", "no"])
    .nullable()
    .describe(
      "Set to 'no' when the user explicitly wants surface-only maps (e.g. 'no underground', 'surface only', 'one level'). Set to 'yes' when they want only two-level maps. Null when unspecified."
    ),
  sort: z
    .enum(["popular", "rating", "newest", "name"])
    .nullable()
    .describe("Sort order. Null = default (popular)."),
});

type SmartFilters = z.infer<typeof SmartFilters>;

const SYSTEM_PROMPT = `You convert natural-language Heroes of Might and Magic 3 map search queries into structured filter parameters.

Map versions:
- RoE = Restoration of Erathia
- AB = Armageddon's Blade
- SoD = Shadow of Death (most common)
- HotA = Horn of the Abyss (popular community expansion)
- WoG = In the Wake of Gods
- Chronicles
- HD
- Other

Map sizes by tile width:
- S = Small (36 tiles)
- M = Medium (72)
- L = Large (108)
- XL = Extra Large (144)
- H = Huge (180, HotA only)
- XH = Extra Huge (216, HotA only)
- G = Giant (252, HotA only)

Factions: castle, rampart, tower, inferno, necropolis, dungeon, stronghold, fortress, conflux.

Difficulty: easy, normal, hard, expert, impossible.

Players: 1–8 (the total number of human-playable slots).

Underground: "yes" = only two-level maps with an underground; "no" = surface-only (no underground / one level / above ground only). Null when the user doesn't mention it.

Sort options: popular | rating | newest | name. Default: popular.

Rules:
- Set fields the user clearly mentioned. Set everything else to null.
- A request like "small two-player necropolis map" → size=S, players=2, faction=necropolis, everything else null.
- "expert difficulty WoG maps" → version=WoG, difficulty=expert.
- "biggest HotA maps" → version=HotA, size=G.
- If the user asks for a specific named map ("Marshland Menace"), put the name in q and leave the rest null.
- Never invent fields the user didn't ask for. Don't guess sort order unless they say "newest", "highest rated", "alphabetical", etc.`;

export type SmartSearchResult =
  | { ok: true; filters: SmartFilters; queryString: string }
  | { ok: false; error: string };

export async function smartSearch(
  query: string
): Promise<SmartSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Type a query first." };
  }
  if (trimmed.length > 300) {
    return { ok: false, error: "Query too long (max 300 chars)." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Search isn't configured (no API key)." };
  }

  const client = new Anthropic({ apiKey });
  let parsed: SmartFilters;
  try {
    const res = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: trimmed }],
      output_config: { format: zodOutputFormat(SmartFilters) },
    });
    if (!res.parsed_output) {
      return {
        ok: false,
        error: "Couldn't understand that. Try rephrasing.",
      };
    }
    parsed = res.parsed_output;
  } catch (e) {
    console.error("smartSearch: Anthropic call failed", e);
    return {
      ok: false,
      error: "Search service hiccupped. Try again or use the regular filters.",
    };
  }

  const params = new URLSearchParams();
  if (parsed.q) params.set("q", parsed.q);
  if (parsed.version) params.set("version", parsed.version);
  if (parsed.size) params.set("size", parsed.size);
  if (parsed.faction) params.set("faction", parsed.faction);
  if (parsed.difficulty) params.set("difficulty", parsed.difficulty);
  if (parsed.players != null) params.set("players", String(parsed.players));
  if (parsed.underground) params.set("underground", parsed.underground);
  if (parsed.sort) params.set("sort", parsed.sort);

  return {
    ok: true,
    filters: parsed,
    queryString: params.toString(),
  };
}

/**
 * Form-action wrapper: parses the form, runs the search, redirects to
 * `/maps?...`. Does not return on success.
 */
export async function smartSearchAndRedirect(formData: FormData) {
  const q = String(formData.get("q") ?? "");
  const res = await smartSearch(q);
  if (!res.ok) {
    redirect(`/maps?nlError=${encodeURIComponent(res.error)}`);
  }
  redirect(`/maps?${res.queryString}`);
}
