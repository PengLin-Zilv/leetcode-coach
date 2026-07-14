# Migration files

This directory holds generated, reviewed, version-controlled SQL migrations. Phase 1
intentionally has no generated migration because `src/db/schema.ts` has no tables.

For every schema change:

1. Change `src/db/schema.ts` deliberately.
2. Run `npm run db:generate`.
3. Review every generated SQL statement by hand. Generation is not approval.
4. Commit the schema change and its migration together.
5. Run the explicit migration command for the intended target only after review.

Never generate or apply migrations from `npm run build`, a Vercel build, or an
automatic deployment hook.
