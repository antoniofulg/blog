# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Extract server fns from `admin/index.tsx` and `admin/preview.$slug.tsx` into co-located `*.server.ts` files. Remove all inline `requireSession` definitions from route files. Task complete.

## Important Decisions

- `getAllPosts` and `togglePublished` exported from `index.server.ts` (were not exported in original route file).
- `getAdminPreview` exported from `preview.$slug.server.ts` (was not exported in original route file).
- Dynamic `import("#/lib/mdx/renderer.server")` in handler replaced with static import — server-only file can use static import safely.
- Test imports updated: `admin-routes.test.ts` now imports from `index.server` and `preview.$slug.server` (not from route files).

## Learnings

- Biome requires `import type { Post }` (not `import { type Post }`) — use bare `import type` form.
- Biome formats single-line `.handler(async () => { ... })` into multi-line when line is too long. Format: `.handler(\n\tasync () => {\n\t\t...\n\t},\n)`.

## Files / Surfaces

- Created: `app/routes/admin/index.server.ts`
- Created: `app/routes/admin/preview.$slug.server.ts`
- Modified: `app/routes/admin/index.tsx` (stripped to route config + UI)
- Modified: `app/routes/admin/preview.$slug.tsx` (stripped to route config + UI)
- Modified: `app/tests/admin-routes.test.ts` (updated import paths)

## Errors / Corrections

- Initial `index.server.ts` had inline `.handler(async () => {...})` on one line — Biome rejected. Split to multi-line.
- Initial `admin/index.tsx` used `import { type Post }` — Biome requires `import type { Post }`.

## Ready for Next Run

Task complete. All 12 admin-routes tests pass. `tsc --noEmit` clean. `make lint` clean. Pre-existing `public-routes.test.ts` DB failure unrelated.
