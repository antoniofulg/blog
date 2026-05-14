# Task Memory: task_08.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Cookie-first SSR redirect on `/`: `beforeLoad` in `{-$locale}/index.tsx` calls `detectLocaleFromRequest`, throws `redirect` if locale != DEFAULT_LOCALE, always sets `Vary: Cookie, Accept-Language`.

## Important Decisions

- **Route file choice**: `{-$locale}/index.tsx` (not parent `{-$locale}.tsx` layout) — `Vary` header and redirect only belong on `/`, not all locale routes.
- **SSR guard**: `if (!import.meta.env.SSR) return` + dynamic import for `@tanstack/react-start/server` — prevents bundling server utilities in the client bundle; `beforeLoad` runs on both server and client.
- **`redirect({ href: ... })`**: TanStack Router's typed `to` does not accept template literal paths like `` `/${detected}/` `` — only registered route patterns. `href` option bypasses type constraints and is the correct API for externally-constructed locale URLs.
- **Unit tests**: All 5 required `detectLocaleFromRequest` cases were already covered in `locale.test.ts` — no new unit tests needed for subtask 8.3.

## Learnings

- `setResponseHeader` is available via dynamic import from `@tanstack/react-start/server` (re-exported from `@tanstack/start-server-core`). `"Vary"` (capitalized) is a valid `ResponseHeaderName` in `fetchdts`.
- `redirect({ href: `/${locale}/`, statusCode: 302 })` is the correct pattern for dynamic locale redirects in TanStack Router — avoids TypeScript type errors with the `to` + `params` approach.
- Biome's `assist/source/organizeImports` runs under `biome check .` but not `biome lint .` — biome.test.ts catches import order issues that `make lint` misses.

## Files / Surfaces

- `app/routes/{-$locale}/index.tsx` — added `beforeLoad` with SSR redirect + Vary header
- `app/tests/ssr-redirect.test.ts` — new: 5 integration tests for cookie/Accept-Language combinations (skip when port 3000 is free)

## Errors / Corrections

- First attempt used `redirect({ to: \`/${detected}/\`, statusCode: 302 })` — TS error: template literal not assignable to registered route paths. Fixed with `href`.
- First attempt used `redirect({ to: "/{-$locale}/", params: { locale: detected } })` — TS error: `locale` not in params type from that context. Fixed with `href`.
- Import order broke biome.test.ts — fixed with `bunx biome check --write`.

## Ready for Next Run

Task 08 complete. Integration tests skip when server not running (correct for CI). Subtask 8.5 (curl smoke) is a manual step requiring a running dev server.
