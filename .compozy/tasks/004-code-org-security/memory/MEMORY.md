# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

task_01 complete. `app/types/content.ts` and `app/types/auth.ts` exist. `__root.tsx` re-exports from `#/types/auth`. `indexer.ts` uses inlined Date return type.
task_02 complete. `app/lib/session.ts` exists with `requireSession(): Promise<void>` — throw-only, ADR-004 compliant. Ready for task_04 import.
task_03 complete. `app/lib/mdx/parser.server.ts` (parseFrontmatter) and `app/lib/mdx/renderer.server.ts` (renderMdx) exist. `mdx.server.ts` deleted. `admin/preview.$slug.tsx` import path updated minimally (dynamic import only); task_04 handles full server fn extraction.
task_04 complete. `app/routes/admin/index.server.ts` and `app/routes/admin/preview.$slug.server.ts` created. Route files stripped to route config + UI. `admin-routes.test.ts` imports updated to server files. Zero inline `requireSession` in routes.

## Shared Decisions

- ADR-003: `PostFrontmatter` in `app/types/content.ts` uses `publishedAt?: string`. `indexer.ts` uses inlined `publishedAt?: Date` — these are intentionally different. Do NOT unify them.
- `__root.tsx` keeps `export type { AuthUser, RouterContext }` re-export to avoid breaking any consumers that import from `__root`.
- `public-routes.test.ts` has a pre-existing DB duplicate key failure (not caused by task changes, verified via stash).

## Shared Learnings

- Biome import order: `@tanstack/*` sorts before `#/*` (alphabetical). TechSpec code samples may use spaces; project uses tabs.

## Open Risks

- `public-routes.test.ts` flaky due to test isolation — pre-existing. Not a blocker for task_01.

## Handoffs
