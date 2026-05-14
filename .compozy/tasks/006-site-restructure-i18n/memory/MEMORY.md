# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Task 01 (F9 indexer stabilization) complete. Phase 1 may proceed.
- Smoke pass confirmed: `bun run sync` indexes 2 posts from `content/en/` (react-suspense-typescript, component-composition-react). lorem-ipsum moved to fixtures.

## Shared Decisions

- Testable plugin logic pattern: extract `configureServer` body into a separate module (`app/lib/dev-boot.ts`) so unit tests can call it directly without the `VITEST` guard. Apply this pattern to any future Vite plugin logic that needs unit coverage.

## Shared Learnings

- Pre-existing test failures (baseline): 14 failing tests, 4 failing test files (`indexer-integ`, `sync-integ` partial, `drizzle-schema`, `seed`). All require a live PostgreSQL instance. Not caused by any task in this workflow — do not investigate unless a task explicitly needs DB integration.
- Biome pre-existing warnings (3): `app/lib/locale.tsx` `noDocumentCookie`, `app/tests/docker-compose.test.ts` `noTemplateCurlyInString` × 2. `make lint` exits 0 despite these (warnings, not errors).
- `content/` currently has 3 MDX files (all in `en/`). Task 05 will move `lorem-ipsum.mdx` to `app/tests/fixtures/`.

## Open Risks

- `content/en/lorem-ipsum.mdx` has been moved to `app/tests/fixtures/lorem-ipsum.mdx` (Task 05 complete). Sync pipeline no longer sees it.

## Handoffs

- Task 05 (move lorem-ipsum fixture) complete. Phase 1 (tasks 01–05) all done.
- Task 06 (rename $lang/* to {-$locale}/*) complete. Phase 2 begun.
- Task 02 (header/footer cleanup) has no dependency on Task 01 but should be merged after Phase 1 is verified green.

## Critical Routing Fact (Phase 2+)

- TanStack Router `{-$locale}` optional param name is **`locale`** (not `_locale`). ADR-004 speculated `params._locale` — incorrect. Use `params.locale` in all route components and `{ locale: ... }` in navigate/Link params.
- Navigate "to" for the locale feed index: `"/{-$locale}"` (no trailing slash). `"/{-$locale}/"` is not a valid `to` value.
- For **dynamic locale redirects** (e.g., `` `/${detected}/` ``), use `redirect({ href: \`/${detected}/\`, statusCode: 302 })`. TanStack Router's typed `to` does not accept template literal paths — only registered route patterns. `href` bypasses type constraints.
- For **SSR-only logic in `beforeLoad`**: guard with `if (!import.meta.env.SSR) return` and dynamically import `@tanstack/react-start/server` inside the guard to prevent server utilities from entering the client bundle.
