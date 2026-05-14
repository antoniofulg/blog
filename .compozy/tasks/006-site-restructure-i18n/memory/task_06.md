---
name: task_06 memory
type: task
description: Execution context for task_06 — rename $lang/* subtree to {-$locale}/*
---

# Task Memory: task_06.md

## Objective Snapshot

Rename `$lang/*` route subtree to `{-$locale}/*` using git mv. Update param access and validate locale in layout. Update all consumers and tests. Status: **complete**.

## Important Decisions

- Layout throws `notFound()` for invalid locale values (not redirect). Old $lang.tsx redirect-to-slug logic removed — no longer needed with optional-param routing.
- Shim routes (blog.tsx, index.tsx, $slug.tsx) updated to redirect to `/{-$locale}` (feed) or `/{-$locale}/$slug` (post). These shims will be deleted in task_07.

## Learnings

- **Critical**: TanStack Router `{-$locale}` generates param name `locale` (not `_locale`) in both component params and navigation. ADR-004 speculated `params._locale` — **wrong**. Actual: `params.locale` (optional `string | undefined`).
- **Navigation "to" for locale feed index**: use `"/{-$locale}"` (no trailing slash). TypeScript will error on `"/{-$locale}/"` — it's not in the `to` union type.
- `routeTree.gen.ts` auto-regenerated after git mv (likely a Vite watcher running in background). All `{-$locale}` routes appeared correctly with no manual edit required.
- `header.tsx` and `post-card.tsx` had hardcoded `$lang` route references that needed updating — these are outside the explicit task scope but required for `make check` to pass.

## Files / Surfaces

- `app/routes/{-$locale}.tsx` — layout, notFound() for invalid locale
- `app/routes/{-$locale}/index.tsx` — blog feed (was blog.tsx)
- `app/routes/{-$locale}/index.server.ts` — (was blog.server.ts), content unchanged
- `app/routes/{-$locale}/$slug.tsx` — post detail
- `app/routes/{-$locale}/$slug.server.ts` — content unchanged
- `app/routes/blog.tsx`, `index.tsx`, `$slug.tsx` — shim routes updated to use new route paths
- `app/components/layout/header.tsx` — switchLang updated to `/{-$locale}` and `/{-$locale}/$slug`
- `app/components/ui/post-card.tsx` — Link updated to `/{-$locale}/$slug` with `locale` param
- `app/tests/lang-route.test.ts` — rewritten for optional-param behavior
- `app/tests/lang-blog-route.test.ts` — import path + integration URLs updated
- `app/tests/lang-slug-route.test.ts` — import path + integration URLs updated
- `app/tests/header.test.ts` — navigate expectations updated for new route paths
- `vite.config.ts` — importProtection excludeFiles updated
- `routeTree.gen.ts` — auto-regenerated, no manual changes

## Errors / Corrections

- ADR-004 param name speculation: used `params._locale` throughout, but actual TypeScript type shows `params.locale`. All route files updated accordingly.

## Ready for Next Run

- task_07: Delete top-level shim routes (blog.tsx, index.tsx, $slug.tsx, about.tsx). These shims now redirect to the new `{-$locale}` routes.
- task_08: Add cookie-first SSR redirect `beforeLoad` to `{-$locale}/index.tsx`.
- task_09: Update hreflang links to use canonical `/` (no `/en/` prefix) for English posts.
