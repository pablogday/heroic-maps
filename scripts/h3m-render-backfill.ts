/**
 * Render our own marker-rich minimap PNGs for every map where the
 * parser fully walks the object layer. Uploads to R2 at
 * `previews/rendered/<id>.png` (and `_und.png` for underground), then
 * updates `previewKey` / `undergroundPreviewKey` to point at them.
 *
 * Idempotent: skips maps whose previewKey already points to our
 * `previews/rendered/` namespace.
 *
 *   npm exec tsx scripts/h3m-render-backfill.ts -- --dry --limit=10
 *   npm exec tsx scripts/h3m-render-backfill.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";
import pLimit from "p-limit";
import sharp from "sharp";
import { parseH3m, unwrapMapFile, renderMinimap } from "../src/lib/h3m";
import { r2Put, r2PublicUrl } from "../src/lib/r2";

type Args = { dry: boolean; limit?: number; concurrency: number; force: boolean };
function parseArgs(): Args {
  const a: Args = { dry: false, concurrency: 4, force: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry") a.dry = true;
    else if (arg === "--force") a.force = true;
    else if (arg.startsWith("--limit=")) a.limit = Number(arg.slice(8));
    else if (arg.startsWith("--concurrency=")) {
      a.concurrency = Math.min(8, Math.max(1, Number(arg.slice(14))));
    }
  }
  return a;
}

async function main() {
  const args = parseArgs();
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  try {
    const filter = args.force
      ? `object_stats IS NOT NULL`
      : `object_stats IS NOT NULL AND (preview_key IS NULL OR preview_key NOT LIKE '%previews/rendered/%')`;
    const limitClause = args.limit ? `LIMIT ${args.limit}` : "";
    const rows = (await sql.unsafe(
      `SELECT id, slug, file_key, has_underground
       FROM maps
       WHERE file_key LIKE 'http%' AND ${filter}
       ORDER BY id ${limitClause}`
    )) as Array<{
      id: number;
      slug: string;
      file_key: string;
      has_underground: boolean;
    }>;

    console.log(
      `${args.dry ? "[DRY] " : ""}Regenerating minimaps for ${rows.length} maps`
    );

    let written = 0;
    let failed = 0;
    let processed = 0;
    const limit = pLimit(args.concurrency);
    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          processed++;
          if (processed % 50 === 0)
            console.log(`  …${processed}/${rows.length}`);
          try {
            const archive = new Uint8Array(
              await (await fetch(row.file_key)).arrayBuffer()
            );
            const u = unwrapMapFile(archive);
            if (!u.ok) {
              failed++;
              return;
            }
            const r = parseH3m(u.bytes);
            if (!r.terrain) {
              failed++;
              return;
            }
            const objects = r.objects?.instances ?? [];

            const surfaceImg = renderMinimap(r.terrain, {
              tileSize: 4,
              underground: false,
              objects,
            });
            const surfacePng = await sharp(Buffer.from(surfaceImg.pixels.buffer), {
              raw: {
                width: surfaceImg.width,
                height: surfaceImg.height,
                channels: 4,
              },
            })
              .png({ compressionLevel: 9 })
              .toBuffer();

            let undergroundUrl: string | null = null;
            if (r.terrain.underground) {
              const undImg = renderMinimap(r.terrain, {
                tileSize: 4,
                underground: true,
                objects,
              });
              const undPng = await sharp(Buffer.from(undImg.pixels.buffer), {
                raw: {
                  width: undImg.width,
                  height: undImg.height,
                  channels: 4,
                },
              })
                .png({ compressionLevel: 9 })
                .toBuffer();
              const undKey = `previews/rendered/${row.id}_und.png`;
              if (!args.dry) await r2Put(undKey, undPng, "image/png");
              undergroundUrl = r2PublicUrl(undKey);
            }

            const surfaceKey = `previews/rendered/${row.id}.png`;
            if (!args.dry) await r2Put(surfaceKey, surfacePng, "image/png");
            const surfaceUrl = r2PublicUrl(surfaceKey);

            if (!args.dry) {
              await sql`UPDATE maps SET preview_key = ${surfaceUrl}, underground_preview_key = ${undergroundUrl}, updated_at = NOW() WHERE id = ${row.id}`;
            }
            written++;
          } catch (e) {
            failed++;
            if (failed < 5) {
              console.error(
                `  fail ${row.id} ${row.slug}: ${e instanceof Error ? e.message : e}`
              );
            }
          }
        })
      )
    );

    console.log(`\nWritten: ${written}`);
    console.log(`Failed:  ${failed}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
