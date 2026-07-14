# Foundation probe retirement

The root connectivity probe exists only for the Phase 1 Vercel/Turso walking skeleton.
Remove `src/app/page.tsx`, `src/app/page.module.css`, and the foundation connectivity
feature at the start of Phase 2, before adding product routes. A public route that runs
a database query on every request must not survive into the product workflow.
