---
name: task-04-memory
description: Task 04 local execution context for about.mdx migration
metadata:
  type: task
---

# Task Memory: task_04.md

## Objective Snapshot

Migrate `about.mdx` from `content/<locale>/` → `app/content/pages/<locale>/`. Delete legacy about route, server fn, MDX loader, and test.

## Important Decisions

- `about.test.ts` DELETED (not retarget) — `pages.test.ts` from task_03 covers `pages.server.ts` comprehensively. Integration tests for `/about` URL are task_05's scope.
- `about.mdx` frontmatter has extra `locale` and `links` fields — left in place, ignored by `pages.server.ts` (only reads `title` and `description`). Harmless.
- `routeTree.gen.ts` manually edited — `bunx tsr generate` failed ("No files matched entrypoints") in this worktree; `tsr` has no standalone CLI, generation happens via `tanstackStart` vite plugin at `bun dev`/`bun build` time. Manually removing the `about` route references was the only option.

## Files / Surfaces

Moved:
- `content/en/about.mdx` → `app/content/pages/en/about.mdx`
- `content/pt-br/about.mdx` → `app/content/pages/pt-br/about.mdx`

Deleted:
- `app/routes/{-$locale}/about.tsx`
- `app/routes/{-$locale}/about.server.ts`
- `app/lib/mdx/about.server.ts`
- `app/tests/about.test.ts`

Modified:
- `app/routeTree.gen.ts` — removed all `about` route entries
- `vite.config.ts` — removed `about.server.ts` from `importProtection.client.excludeFiles`
- `app/components/layout/header.tsx` — fixed navigate calls from `/{-$locale}/about/` to `/{-$locale}/$slug/` with `slug: "about"`
- `app/tests/header.test.ts` — updated assertion to match new slug-based navigation

## Learnings

- `app/content/pages/` dir did NOT exist before task_04 — created with mkdir.
- `about.server.ts` reads from `content/<locale>/about.mdx` (relative to cwd, no `app/` prefix).
- `pages.server.ts` reads from `app/content/pages/<locale>/` (absolute join with cwd).
- `header.tsx` had hardcoded `/{-$locale}/about/` navigate targets — these caused 4 TS type errors after route deletion; fixed to use `/{-$locale}/$slug/` with `slug: "about"`.
- `vite.config.ts` `importProtection.client.excludeFiles` list includes co-located `*.server.ts` files — must be updated when those files are deleted.

## Verification

- `bunx tsc --noEmit`: exit 0 (clean)
- `bun run check`: exit 0 (11 warnings, 5 infos — all pre-existing)
- `bun run test`: 870 pass, 14 fail (all pre-existing DB/network integration failures)
- All ACs met.

## Status: COMPLETE
