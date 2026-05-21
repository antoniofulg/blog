# Task Memory: task_13.md

## Objective Snapshot

Trim admin: delete preview routes, remove togglePublishedFn, add locale filter + View buttons. Target ≤100 LOC across admin/**.

## Important Decisions

- Used `<ul>/<li>` list instead of `<table>` to hit the ≤100 LOC target — Biome formatting expands table `<th>/<td>` with Tailwind classes beyond single lines.
- Used plain `<a href>` tags for locale filter nav instead of TanStack `<Link>` — shorter, avoids prop-wrapping by Biome, acceptable for SSR admin utility.
- `viewHref` logic inlined as component-local arrow fn (not exported) — no need to export from .tsx; test file mirrors logic with local `postUrl` helper.
- Removed `admin/preview.$slug.tsx` entry from `ROUTE_METADATA` in `site-model.server.ts` — required to fix inventory count test post-deletion.

## Learnings

- Biome (lineWidth=80, tabWidth=2) expands any JSX element exceeding 80 chars; table cells with Tailwind classes nearly always exceed this. `<ul>/<li>` structure is far more compact.
- `ROUTE_METADATA` drift test catches files in routes/ that are NOT in ROUTE_METADATA, but NOT the reverse (stale entries with no file). Must manually remove stale entries when deleting routes.
- `site-model.test.ts` had 2 tests specifically testing `admin/preview.$slug.tsx` ROUTE_METADATA entry — removed those after deleting the entry.
- Pre-existing failures: `biome.test.ts` (browser-sweep.server.ts lint), `sitemap.test.ts` (22 TS errors) — not regressions.

## Files / Surfaces

- DELETED: `app/routes/admin/preview.$slug.tsx`
- DELETED: `app/routes/admin/preview.$slug.server.ts`
- MODIFIED: `app/routes/admin/index.tsx` — rewritten with locale filter + View button; 74 LOC
- MODIFIED: `app/routes/admin/index.server.ts` — removed togglePublishedFn + togglePublished; 19 LOC
- MODIFIED: `app/routeTree.gen.ts` — removed all AdminPreviewSlugRoute references
- MODIFIED: `vite.config.ts` — removed preview.$slug.server.ts from importProtection.client.excludeFiles
- MODIFIED: `app/tests/admin-routes.test.ts` — stripped toggle/preview tests; added locale filter + postUrl tests; 13 tests pass
- MODIFIED: `app/lib/site-model.server.ts` — removed admin/preview.$slug.tsx from ROUTE_METADATA
- MODIFIED: `app/tests/site-model.test.ts` — removed 2 tests referencing deleted preview route

## Errors / Corrections

- Initial wc -l = 132 (index.tsx=113, server.ts=19) → switched from `<table>` to `<ul>/<li>` → 93 total ✓
- site-model.test.ts inventory count failed after route deletion → fixed by removing ROUTE_METADATA entry + 2 stale test cases

## Ready for Next Run

Task complete. Only task_14 (CONTENT.md docs update) remains pending.
