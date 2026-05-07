# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/types/` with `content.ts` and `auth.ts`. Move `AuthUser`/`RouterContext` from `__root.tsx`. Remove duplicate `interface PostFrontmatter` from `indexer.ts`. Convert `interface TocItem` to `type`. Keep `interface Register` in `router.tsx` untouched. COMPLETE.

## Important Decisions

- `__root.tsx` already used `export type` (not `interface`) for AuthUser/RouterContext — moved to `#/types/auth`, replaced with re-export.
- `indexer.ts` `interface PostFrontmatter` (lines 8-13) removed; `parseFrontmatterBlock` uses inlined return type with `publishedAt?: Date` (not string) per ADR-003.
- `app/types/content.ts` uses `publishedAt?: string` — display use only.
- `router.tsx` — `interface Register` left untouched (TanStack Router module augmentation).
- `public-routes.test.ts` DB duplicate key failure is pre-existing (verified via git stash), not caused by these changes.

## Learnings

- `__root.tsx` re-exports types from `#/types/auth` with `export type { AuthUser, RouterContext }` to preserve downstream consumers importing from `__root`.

## Files / Surfaces

- `app/types/content.ts` — CREATED
- `app/types/auth.ts` — CREATED
- `app/routes/__root.tsx` — types removed, import + re-export added
- `app/db/indexer.ts` — interface removed, return type inlined
- `app/components/ui/table-of-contents.tsx` — interface → type

## Errors / Corrections

## Ready for Next Run

task_01 complete. task_03 (MDX Library Split) depends on `app/types/content.ts` now available at `#/types/content`.
