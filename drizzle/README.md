# Migration files

This directory holds generated, reviewed, version-controlled SQL migrations.
`0000_adaptive_spine.sql` is the reviewed first domain migration. It creates the ten
Phase 2 adaptive-spine tables and their required constraints and indexes.

For every schema change:

1. Change `src/db/schema.ts` deliberately.
2. Run `npm run db:generate`.
3. Review every generated SQL statement by hand. Generation is not approval.
4. Commit the schema change and its migration together.
5. Run the explicit migration command for the intended target only after review.

Never generate or apply migrations from `npm run build`, a Vercel build, or an
automatic deployment hook.

Drizzle's SQLite renderer preserves explicit foreign-key and composite-primary-key
names in `src/db/schema.ts` and the generated snapshot, while the SQL migration
renders those clauses without `CONSTRAINT <name>`. Review the schema, snapshot, and
SQL together to confirm both the declared names and the executable SQLite semantics.
