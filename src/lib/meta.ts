import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  difficultyLevelsTable,
  mapSizesTable,
  mapVersionsTable,
} from "@/db/schema";
import {
  DIFFICULTY_LABEL,
  SIZE_LABEL,
  VERSION_LABEL,
  type Difficulty,
  type Size,
  type Version,
} from "./map-constants";

/**
 * Server-side cache of the lookup tables (`map_versions`, `map_sizes`,
 * `difficulty_levels`). Loaded once per process — these change so
 * rarely (only via a migration) that revalidating on every request is
 * pointless. Cold start re-fetches.
 *
 * The DB is the canonical source of truth. The constants in
 * `map-constants.ts` exist as a parallel TS mirror for client-side code
 * that can't await an async DB call (e.g. filter dropdowns rendered on
 * the client). They must stay in sync — see the migration in
 * `drizzle/0001_*.sql` for the seed data.
 */

type Meta = {
  versionLabel: Map<string, string>;
  sizeLabel: Map<string, string>;
  difficultyLabel: Map<string, string>;
  versions: { code: Version; name: string; sortOrder: number }[];
  sizes: { code: Size; name: string; sortOrder: number }[];
  difficulties: { code: Difficulty; name: string; sortOrder: number }[];
};

let _meta: Promise<Meta> | null = null;

export function getMeta(): Promise<Meta> {
  if (_meta) return _meta;
  _meta = loadMeta();
  return _meta;
}

async function loadMeta(): Promise<Meta> {
  const [versions, sizes, difficulties] = await Promise.all([
    db
      .select()
      .from(mapVersionsTable)
      .orderBy(asc(mapVersionsTable.sortOrder)),
    db.select().from(mapSizesTable).orderBy(asc(mapSizesTable.sortOrder)),
    db
      .select()
      .from(difficultyLevelsTable)
      .orderBy(asc(difficultyLevelsTable.sortOrder)),
  ]);

  return {
    versions: versions as Meta["versions"],
    sizes: sizes as Meta["sizes"],
    difficulties: difficulties as Meta["difficulties"],
    versionLabel: new Map(versions.map((v) => [v.code, v.name])),
    sizeLabel: new Map(sizes.map((s) => [s.code, s.name])),
    difficultyLabel: new Map(difficulties.map((d) => [d.code, d.name])),
  };
}

/**
 * Synchronous label lookups for cases where awaiting `getMeta()` is
 * impractical (e.g. inside a tight render loop). Falls back to the TS
 * constants — same data, just in-memory.
 */
export function versionLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return VERSION_LABEL[code as Version] ?? code;
}
export function sizeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return SIZE_LABEL[code as Size] ?? code;
}
export function difficultyLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return DIFFICULTY_LABEL[code as Difficulty] ?? code;
}
