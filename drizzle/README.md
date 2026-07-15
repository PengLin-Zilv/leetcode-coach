# Migration files

This directory contains generated, reviewed, version-controlled SQL migrations.
`0000_adaptive_spine.sql` is the reviewed first domain migration. It creates the ten
Phase 2 adaptive-spine tables, constraints, foreign keys, and indexes; catalog data is
seeded separately by the protected seed commands.

For every schema change:

1. Change `src/db/schema.ts` deliberately.
2. Run `npm run db:generate`.
3. Review every generated SQL statement by hand. Generation is not approval.
4. Confirm the migration contains only the intended schema change and no seed data,
   credential, destructive operation, or unrelated object change.
5. Commit the schema change and reviewed migration together.
6. Apply committed migrations explicitly with `npm run db:migrate:local` or the
   protected production command.

Local initialization preserves this order:

```bash
npm run db:migrate:local
npm run db:seed:local
```

Production migration and seed are separate manual operator actions:

```bash
npm run db:migrate:production -- --confirm-production
npm run db:seed:production -- --confirm-production
```

Never generate or apply migrations, seed catalog data, or rebuild MEMORY from
`npm run build`, a Vercel build/install command, or an automatic deployment hook.

Drizzle's SQLite renderer preserves explicit foreign-key and composite-primary-key
names in `src/db/schema.ts` and the generated snapshot, while the executable SQLite
SQL renders those clauses without `CONSTRAINT <name>`. Review the schema, snapshot,
and SQL together to confirm both the declared names and the executed semantics.

The Phase 2 catalog seed is idempotent and must retain exactly 18 Patterns, 21
prerequisite edges, 150 Problems, 150 Problem-to-Pattern mappings, and 18 Skill State
rows. Difficulty alone determines estimated time: Easy is 15 minutes, Medium is 30
minutes, and Hard is 45 minutes. Seed changes belong in the catalog seed boundary,
not in migration SQL.
