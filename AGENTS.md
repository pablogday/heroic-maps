<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Database migrations

All schema changes go through Drizzle migrations. **Never** write ad-hoc
SQL scripts that mutate prod schema (no more `scripts/migrate-*.ts`).

Workflow:
1. Edit `src/db/schema.ts`
2. `npm run db:generate -- --name short_description` produces an
   incremental migration in `drizzle/`
3. **Review the generated SQL.** Drizzle is conservative but will
   sometimes pick destructive paths (column drops, type changes). If the
   diff isn't what you want, edit `schema.ts` and regenerate.
4. Test against a Neon DB branch first (`Branches → New Branch` from the
   Neon console; export its URL into `DATABASE_URL` and run
   `npm run db:migrate`).
5. Commit the migration files alongside the schema change.
6. Run `npm run db:migrate` against prod (or rely on a deploy hook).

The baseline migration `drizzle/0000_baseline.sql` represents the schema
as it existed when migration discipline was adopted. It's already
recorded as applied in the prod `drizzle.__drizzle_migrations` table —
do not delete it or its journal entry.

## Backups & recovery

Two layers of safety on the data:

1. **Neon point-in-time restore.** Free tier keeps a 24-hour history.
   To recover from a recent mistake, create a Neon branch from a
   timestamp before the bad change, swap your env var to its connection
   string to inspect, and either copy data back or promote the branch.

2. **Local JSON snapshots.** Run `npm run db:snapshot` to dump every
   user-data table (excludes auth tokens) to
   `backups/<timestamp>/*.json`. Schema travels separately in
   `drizzle/`. Together they're a full reproducible backup.

   - Run **before** any potentially destructive operation (bulk
     scripts, rebuilds, schema migrations on prod).
   - Restore with `npm run db:restore -- backups/<timestamp>` against
     a freshly-migrated empty DB. The restore script:
     - Refuses to run if the target tables already have rows.
     - Inserts inside a single transaction (atomic).
     - Resets all sequences so new inserts don't collide.

`backups/` is gitignored — snapshots stay local, never committed.

## .h3m parser regression testing

The parser at `src/lib/h3m/` has unit tests under `__tests__/` (run via
`npm test`), but the real regression coverage comes from running the
parser against the actual corpus:

  - `npm run h3m:coverage` — parses every map in R2, reports per-format
    high/partial/failed counts, terrain reach + plausibility, and
    histograms of victory/loss conditions. Any structural bug shows up
    as either a coverage drop or a chaotic distribution.
  - `npm run h3m:validate` — compares parser output vs. DB ground truth
    for name/size/players/factions/etc. per-field disagreement rates.
  - `npm run h3m:debug -- <slug-or-id>` — hex-dumps a single map and
    shows what the parser extracted, for reverse-engineering edge cases.
  - `npm run h3m:walk-trace -- --id=<n>` — traces section-by-section
    cursor positions through `walkToTerrain`, for finding where a
    specific map's walk misaligns.

**Run `h3m:coverage` after any parser change.** Don't merge a regression
unless it's a deliberate trade-off documented in the commit message.

## Lookup tables (versions, sizes, difficulties)

Three lookup tables hold the canonical full-name labels for the enum'd
"types": `map_versions`, `map_sizes`, `difficulty_levels`. Each row is
`(code, name, sort_order)` where `code` matches the existing pg enum
value and `name` is the human label.

The DB is the source of truth. A TS mirror in `lib/map-constants.ts`
exists for client components that can't await an async DB call during
render.

**When adding or changing a label:**

1. Edit `lib/map-constants.ts` (the TS mirror).
2. Write a Drizzle migration that updates the corresponding lookup
   table — typically a tiny `UPDATE map_versions SET name = ...` or
   `INSERT`.
3. Run `npm run check:meta` to confirm DB and TS agree before
   committing.

The check script exits non-zero on drift; wire it into pre-commit / CI
when you're ready to.
