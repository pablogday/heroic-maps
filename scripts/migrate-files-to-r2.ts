/**
 * Move map preview images and downloadable .h3m/.zip files from
 * maps4heroes.com into our own R2 bucket. Per map:
 *
 *   1. Download surface preview from `previewKey` (currently a
 *      maps4heroes URL) → upload to `previews/<id>.<ext>` in R2 →
 *      store the public R2 URL back in `previewKey`.
 *
 *   2. If hasUnderground, do the same for the underground variant
 *      (URL is the surface URL with /img/ → /img_und/) and store in
 *      `undergroundPreviewKey`.
 *
 *   3. Resolve the actual file URL by hitting maps4heroes' rating
 *      page (same flow the old download API route used) → download →
 *      upload to `maps/<id>.<ext>` → store the public R2 URL in
 *      `fileKey` and the byte size in `fileSize`.
 *
 * Resumable: skips any step whose target already exists in R2 *and*
 * is referenced from the DB. So re-running picks up where it left off.
 *
 * Throttled: caps concurrency to 4 maps in flight, with a small jitter
 * between requests so we don't hammer maps4heroes.
 *
 *   --kind=previews|files|both   (default both)
 *   --limit=N                    only process N maps (testing)
 *   --dry                        report what would happen, write nothing
 *   --force                      ignore "already migrated" check, re-upload
 *   --concurrency=N              parallel maps (default 4, max 8)
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import {
  r2Put,
  r2Exists,
  r2PublicUrl,
  getR2PublicUrl,
} from "../src/lib/r2";

const UA = "HeroicMaps/0.1 (hobby; contact via heroicmaps.app)";
const FILE_HREF =
  /href=["'](https?:\/\/www\.maps4heroes\.com\/heroes3\/maps\/[^"']+\.(?:zip|h3m|h3c|rar))["']/i;

type Args = {
  kind: "previews" | "files" | "both";
  limit?: number;
  dry: boolean;
  force: boolean;
  concurrency: number;
};
function parseArgs(): Args {
  const a: Args = { kind: "both", dry: false, force: false, concurrency: 4 };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--force") a.force = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--kind=")) {
      const k = arg.slice(7);
      if (k === "previews" || k === "files" || k === "both") a.kind = k;
    } else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(8, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

type MapRow = {
  id: number;
  slug: string;
  preview_key: string | null;
  underground_preview_key: string | null;
  has_underground: boolean;
  file_key: string;
  file_size: number | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBytes(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function extOf(url: string): string {
  const m = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return (m?.[1] ?? "bin").toLowerCase();
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "zip": return "application/zip";
    case "rar": return "application/x-rar-compressed";
    case "h3m":
    case "h3c": return "application/octet-stream";
    default: return "application/octet-stream";
  }
}

/** Heuristic: did we already write this map's preview to R2? */
function previewIsMigrated(m: MapRow): boolean {
  return !!m.preview_key && m.preview_key.startsWith(getR2PublicUrl());
}
function fileIsMigrated(m: MapRow): boolean {
  return m.file_key.startsWith("http");
}

type Result = {
  id: number;
  ok: boolean;
  reason: string;
  uploaded: { previews: number; files: number };
};

async function processMap(
  sql: postgres.Sql,
  m: MapRow,
  args: Args
): Promise<Result> {
  const result: Result = {
    id: m.id,
    ok: true,
    reason: "",
    uploaded: { previews: 0, files: 0 },
  };

  // ─── Previews ────────────────────────────────────────────────
  if (args.kind === "previews" || args.kind === "both") {
    if (!m.preview_key) {
      result.reason += "no source preview; ";
    } else if (!args.force && previewIsMigrated(m)) {
      result.reason += "previews already migrated; ";
    } else {
      const sourcePreviewUrl = m.preview_key;
      const ext = extOf(sourcePreviewUrl);
      const surfaceKey = `previews/${m.id}.${ext}`;

      let surfaceUrl: string | null = null;
      let undergroundUrl: string | null = null;

      // Surface
      if (args.force || !(await r2Exists(surfaceKey))) {
        const buf = await fetchBytes(sourcePreviewUrl);
        if (!buf) {
          result.ok = false;
          result.reason += `surface fetch failed (${sourcePreviewUrl}); `;
          return result;
        }
        if (!args.dry) {
          await r2Put(surfaceKey, buf, contentTypeFor(ext));
        }
        result.uploaded.previews++;
      }
      surfaceUrl = r2PublicUrl(surfaceKey);

      // Underground
      if (m.has_underground) {
        const sourceUnderground = sourcePreviewUrl.replace(
          "/img/",
          "/img_und/"
        );
        const underKey = `previews/${m.id}_und.${ext}`;
        if (args.force || !(await r2Exists(underKey))) {
          const buf = await fetchBytes(sourceUnderground);
          if (buf) {
            if (!args.dry) {
              await r2Put(underKey, buf, contentTypeFor(ext));
            }
            result.uploaded.previews++;
            undergroundUrl = r2PublicUrl(underKey);
          } else {
            result.reason += "underground fetch failed (continuing); ";
          }
        } else {
          undergroundUrl = r2PublicUrl(underKey);
        }
      }

      if (!args.dry) {
        await sql`
          UPDATE maps
          SET preview_key = ${surfaceUrl},
              underground_preview_key = ${undergroundUrl},
              updated_at = now()
          WHERE id = ${m.id}
        `;
      }
    }
  }

  // ─── File (.h3m / .zip) ──────────────────────────────────────
  if (args.kind === "files" || args.kind === "both") {
    if (!args.force && fileIsMigrated(m)) {
      result.reason += "file already migrated; ";
    } else {
      const sourceMatch = m.file_key.match(/^source:(\d+)$/);
      if (!sourceMatch) {
        result.ok = false;
        result.reason += `unexpected file_key "${m.file_key}"; `;
        return result;
      }
      const sourceId = sourceMatch[1];
      // Resolve the real download URL by scraping the rating page.
      const ratingUrl = `https://www.maps4heroes.com/heroes3/rating.php?testcookie=1&id=${sourceId}`;
      const ratingHtml = await (
        await fetch(ratingUrl, {
          headers: { "User-Agent": UA, Cookie: "testcookie=1" },
        })
      ).text();
      const hrefMatch = ratingHtml.match(FILE_HREF);
      if (!hrefMatch) {
        result.ok = false;
        result.reason += "could not resolve file URL; ";
        return result;
      }
      const sourceFileUrl = hrefMatch[1];
      const ext = extOf(sourceFileUrl);
      const fileKey = `maps/${m.id}.${ext}`;

      let fileSize = m.file_size;
      if (args.force || !(await r2Exists(fileKey))) {
        const buf = await fetchBytes(sourceFileUrl);
        if (!buf) {
          result.ok = false;
          result.reason += `file fetch failed; `;
          return result;
        }
        fileSize = buf.length;
        if (!args.dry) {
          await r2Put(fileKey, buf, contentTypeFor(ext));
        }
        result.uploaded.files++;
      }

      if (!args.dry) {
        await sql`
          UPDATE maps
          SET file_key = ${r2PublicUrl(fileKey)},
              file_size = ${fileSize},
              updated_at = now()
          WHERE id = ${m.id}
        `;
      }
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!getR2PublicUrl()) {
    throw new Error("R2_PUBLIC_URL not set — needed to build public URLs");
  }
  const sql = postgres(url, { max: 1 });

  const rows = (await sql<MapRow[]>`
    SELECT id, slug, preview_key, underground_preview_key,
           has_underground, file_key, file_size
    FROM maps
    ORDER BY id ASC
    ${args.limit ? sql`LIMIT ${args.limit}` : sql``}
  `) as MapRow[];

  console.log(
    `Migration target: ${rows.length} maps · kind=${args.kind} · ` +
      `concurrency=${args.concurrency} · dry=${args.dry} · force=${args.force}\n`
  );

  const limit = pLimit(args.concurrency);
  const stats = {
    ok: 0,
    failed: 0,
    skipped: 0,
    previews: 0,
    files: 0,
  };

  let done = 0;
  await Promise.all(
    rows.map((m) =>
      limit(async () => {
        // Small jitter — keeps maps4heroes happy.
        await sleep(50 + Math.random() * 200);
        try {
          const r = await processMap(sql, m, args);
          if (r.ok) stats.ok++;
          else stats.failed++;
          if (r.uploaded.previews === 0 && r.uploaded.files === 0)
            stats.skipped++;
          stats.previews += r.uploaded.previews;
          stats.files += r.uploaded.files;
          done++;
          const tag = r.ok ? "✓" : "✗";
          if (
            r.uploaded.previews > 0 ||
            r.uploaded.files > 0 ||
            !r.ok
          ) {
            console.log(
              `[${done}/${rows.length}] ${tag} ${m.slug}  ` +
                `(prev:${r.uploaded.previews} file:${r.uploaded.files}) ` +
                (r.reason ? `— ${r.reason.trim()}` : "")
            );
          }
        } catch (e) {
          stats.failed++;
          done++;
          console.error(`[${done}/${rows.length}] ✗ ${m.slug} — ${e}`);
        }
      })
    )
  );

  console.log(
    `\nDone. ok=${stats.ok} failed=${stats.failed} skipped=${stats.skipped} ` +
      `· uploaded ${stats.previews} previews + ${stats.files} files`
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
