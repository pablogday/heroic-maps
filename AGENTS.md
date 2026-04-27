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
