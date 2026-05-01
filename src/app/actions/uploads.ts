"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { maps } from "@/db/schema";
import { r2Put, r2PublicUrl } from "@/lib/r2";
import { FACTIONS } from "@/lib/factions";
import { VERSIONS, SIZES, DIFFICULTIES } from "@/lib/map-constants";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = ["h3m", "h3c", "zip"] as const;
const DAILY_LIMIT = 5;

const Schema = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  version: z.enum(VERSIONS),
  size: z.enum(SIZES),
  humanPlayers: z.coerce.number().int().min(1).max(8),
  aiPlayers: z.coerce.number().int().min(0).max(7),
  difficulty: z.enum(DIFFICULTIES).optional().or(z.literal("")),
  hasUnderground: z.coerce.boolean(),
  factions: z.array(z.enum(FACTIONS)).max(9).optional(),
});

export type UploadResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function uploadMap(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in required." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a map file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is over 8 MB. Zip it tighter or trim." };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return {
      ok: false,
      error: "File must be .h3m, .h3c, or .zip.",
    };
  }

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    version: formData.get("version"),
    size: formData.get("size"),
    humanPlayers: formData.get("humanPlayers"),
    aiPlayers: formData.get("aiPlayers"),
    difficulty: formData.get("difficulty") || undefined,
    hasUnderground: formData.get("hasUnderground") === "on",
    factions: formData.getAll("factions"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: `${first.path.join(".") || "form"}: ${first.message}`,
    };
  }
  const data = parsed.data;
  const totalPlayers = data.humanPlayers + data.aiPlayers;
  if (totalPlayers < 2 || totalPlayers > 8) {
    return { ok: false, error: "Total players must be between 2 and 8." };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(maps)
    .where(and(eq(maps.uploaderId, userId), gt(maps.createdAt, since)));
  if ((recent[0]?.n ?? 0) >= DAILY_LIMIT) {
    return {
      ok: false,
      error: `Daily upload limit reached (${DAILY_LIMIT}). Try again tomorrow.`,
    };
  }

  const slug = await uniqueSlug(data.name);
  const key = `maps/uploaded/${slug}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const contentType =
    ext === "zip" ? "application/zip" : "application/octet-stream";

  try {
    await r2Put(key, buf, contentType);
  } catch (e) {
    console.error("uploadMap: r2Put failed", e);
    return { ok: false, error: "Storage upload failed. Try again." };
  }

  await db.insert(maps).values({
    slug,
    name: data.name,
    description: data.description || null,
    size: data.size,
    hasUnderground: data.hasUnderground,
    version: data.version,
    difficulty: data.difficulty || null,
    totalPlayers,
    humanPlayers: data.humanPlayers,
    aiPlayers: data.aiPlayers,
    fileKey: r2PublicUrl(key),
    fileSize: file.size,
    uploaderId: userId,
    factions: data.factions && data.factions.length > 0 ? data.factions : null,
    publishedAt: new Date(),
  });

  revalidatePath("/maps");
  revalidatePath("/feed");
  redirect(`/maps/${slug}`);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "map";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db
      .select({ id: maps.id })
      .from(maps)
      .where(eq(maps.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
