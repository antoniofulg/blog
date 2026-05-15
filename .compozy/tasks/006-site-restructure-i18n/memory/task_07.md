---
name: task_07
description: Memory for task_07 — Delete top-level redirect shims
type: project
---

# Task Memory: task_07 — Delete top-level redirect shims

## Objective Snapshot

Delete `app/routes/index.tsx`, `app/routes/blog.tsx`, `app/routes/$slug.tsx`. Update
`routeTree.gen.ts`. Fix downstream type errors in components that referenced deleted
route paths. Update tests to reflect post-shim URL semantics.

## Important Decisions

- `routeTree.gen.ts` manually edited (not regenerated via `bunx tsr generate`) because
  TanStack Start uses a Vite plugin for regen, not a standalone CLI. `tsr generate`
  fails without `tsr.config.json`.
- `{-$locale}.tsx` `beforeLoad` throws `notFound()` for invalid locales (including "blog"),
  making `GET /blog` naturally return 404. No extra route needed.
- `/blog` → `{-$locale}/$slug` with `slug="blog"` → DB miss → `throw notFound()` path.
  Either path gives 404.

## Learnings

- Deleting shim routes caused 6 TS type errors across 4 component files that still
  referenced `to="/"`, `to="/blog"`, `to="/$slug"` as literal strings.
- `Char123LocaleChar125SlugRouteImport` contains the substring `SlugRouteImport` so
  assertions using `not.toContain("SlugRouteImport")` false-fail. Use
  `not.toContain("const SlugRoute =")` instead.
- `biome check .` (used by biome.test.ts) catches formatting issues; `make lint` only
  runs `biome lint`. After editing JSX files, always run `bunx biome format --write` on
  changed files.
- `NAV_LABELS` still has `to: "/"` and `to: "/blog"` (string-typed, no TS error).
  Runtime navigation to `/blog` returns 404. Left for task_08/12 to fix nav links.

## Files / Surfaces

- `app/routes/index.tsx` — DELETED
- `app/routes/blog.tsx` — DELETED
- `app/routes/$slug.tsx` — DELETED
- `app/routeTree.gen.ts` — manually updated, shim imports/defs removed
- `app/components/layout/header.tsx` — logo Link `to="/"` → `to="/{-$locale}"`
- `app/components/ui/post-card.tsx` — else branch Link `to="/$slug"` → `to="/{-$locale}/$slug"`
- `app/components/ui/category-card.tsx` — Link `to="/blog"` → `to="/{-$locale}"` (search prop dropped)
- `app/routes/__root.tsx` — 404 home Link `to="/"` → `to="/{-$locale}"`
- `app/tests/public-routes.test.ts` — legacy redirect suite removed, shim-absence unit
  tests added, integration tests updated for post-shim semantics

## Errors / Corrections

- Initial `id: '/$slug'` test assertion was wrong — `{-$locale}/$slug` child also uses
  relative id `'/$slug'`. Fixed by checking for `const SlugRoute =` absence.

## Ready for Next Run

- Task 08 (cookie-first SSR redirect) can begin. It attaches `beforeLoad` redirect logic
  to `{-$locale}/index.tsx` or the layout.
- Follow-up: `NAV_LABELS` in header.tsx still has `to: "/"` and `to: "/blog"`. These are
  string-typed so no TS errors, but nav "Blog" link leads to 404. Task_08/12 should fix.
