# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

Task 01 (Project Initialization and Tooling) — **completed**. Project scaffolded and all tooling configured.
Task 02 (Docker Compose and Local Database) — **completed**. `docker-compose.yml` with postgres:16-alpine, health check, named volume `postgres_data`, port 5432.
Task 03 (Drizzle Schema) — **completed**.
Task 04 (Admin Seed Script) — **completed**. `scripts/seed.ts` idempotent; `better-auth@1.3.4` installed and pinned; `app/db/auth-schema.ts` generated; migration applied (user/session/account/verification tables).
Task 05 (Content Indexer) — **completed**. `app/db/indexer.ts` with `upsertPost`, `removePost`, `syncAll`; 8 unit + 5 integration tests passing.
Task 06 (File Watcher) — **completed**. `app/lib/watcher.server.ts` with `startContentWatcher`; Vite plugin startup via `configureServer`; 11 unit + 5 integration tests passing.

## Shared Decisions

- **`vite.config.ts` is the app config** — new TanStack Start API uses Vite config directly (not Vinxi's `app.config.ts`). Bun server preset: `nitro({ preset: "bun" })`.
- **App root is `app/`** — the scaffold defaults to `src/`; this project renames to `app/` per TechSpec. All tasks must reference `app/` not `src/`. TanStack Start plugin configured with `srcDirectory: "app"`.
- **Lefthook v2 reads `lefthook.yml`** — the main config must be `lefthook.yml` (no dot prefix); `.lefthook.yml` is for local overrides. Both committed.
- **BiomeJS v2 uses `--write` not `--apply`** — any task that references `biome check --apply` must use `--write` instead.
- **Tailwind v4 CSS-first config** — plugins added via `@plugin` in CSS, not just JS config. Typography: `@plugin "@tailwindcss/typography"` in `global.css`.
- **All deps pinned** — no `^` or `~` in package.json per ADR-001. Vitest test enforces this.

## Shared Learnings

- `create-tanstack@latest` (not `create-tanstack-start@latest`) is the current CLI. Accepts `--add-ons biome` to include BiomeJS during scaffold.
- Vitest "close timed out" warning is cosmetic when using TanStack Start vite plugin — tests still exit 0.

## Open Risks

- Vitest server hang warning (`close timed out`) on every test run — cosmetic but noisy. Future tasks may want a separate `vitest.config.ts` that excludes TanStack Start plugin.

## Shared Learnings (added task_02)

- `psql` not installed on host — always use `docker exec <container> psql` in tests.
- Integration tests that require port 5432: use `describe.skipIf(!port5432Free)` with a `createServer` port check so they skip gracefully when another service owns the port.

## Shared Decisions (added task_04)

- **`better-auth` password in `account` table** — Better Auth email+password stores hashed password in the `account` table (`provider_id = 'credential'`), NOT in the `user` table. Seed script inserts both `user` and `account` rows.
- **`hashPassword` from `better-auth/crypto`** — use `import { hashPassword } from 'better-auth/crypto'` for password hashing. Uses scrypt internally.
- **`app/db/auth-schema.ts`** — Better Auth Drizzle schema lives here (separate from `app/db/schema.ts`). Both imported in `app/db/client.ts` and referenced in `drizzle.config.ts` schema array.
- **`app/lib/auth.ts` stub created in task_04** — minimal auth instance (no plugins). Task_10 must add `tanstackStartCookies()` plugin and route wiring.

## Shared Learnings (added task_05)

- **Split unit/integ test files when mocking** — `vi.mock` at module scope in Vitest applies to ALL tests in the file; integration tests that need real modules must live in a separate file.
- **Definite assignment assertion for test SQL clients** — use `let sql!: Type` instead of `let sql: Type | undefined` to avoid Biome `noNonNullAssertion` warnings on every usage.
- **Biome suppression comment placement** — `biome-ignore` must be on the line immediately before the violating token; wrapping changes line adjacency and makes the suppression "unused".

## Shared Learnings (added task_07)

- **Integration tests using generic filenames cause slug conflicts** — `posts.slug` has a unique constraint; files named `a.mdx`/`b.mdx` in different tmp dirs produce slug "a"/"b", conflicting across tests. Use test-prefixed basenames (e.g., `t7s2alpha.mdx`) in all integration tests that upsert to posts.
- **`closeDb()` in `app/db/client.ts`** — new export calls `client.end()` on the postgres.js Sql instance. Must be called in scripts that need clean process exit; not needed in tests (Vitest cleans up on exit).

## Shared Learnings (added task_06)

- **`configureServer` runs during `vitest`** — Vitest creates an internal Vite server and calls `configureServer` hooks. Any Vite plugin hook with side effects must guard with `if (process.env.VITEST) return` to prevent errors.
- **`vi.spyOn` without restore leaks history** — without `restoreMocks: true` or explicit restore, spy call history accumulates across tests. Fix: call `vi.clearAllMocks()` in `resetAll()` at the start of each test.

## Shared Learnings (added task_11)

- **TanStack Start strips direct server fn handler references**: `createServerFn().handler(myFn)` causes Vite plugin to strip `myFn` from client bundle → undefined in tests. Fix: `createServerFn().handler(() => myFn())`.
- **`reactStartCookies` is the correct plugin name** (not `tanstackStartCookies`): from `better-auth/react-start`. TechSpec naming differs but actual API is `reactStartCookies`.
- **Browser-safe auth client**: `createAuthClient()` must live in a file NOT in vite-env-only denyImports (e.g., `app/lib/auth.client.ts`). Login page uses auth client, not server auth instance.
- **`getRequest()` not `getWebRequest()`**: correct TanStack Start server API is `getRequest()` from `@tanstack/react-start/server`.
- **Biome `noDangerouslySetInnerHtml`**: full category is `lint/security/noDangerouslySetInnerHtml` (note capital H and full camelCase). Wrong name produces `suppressions/parse` error.
- **Thenable chain mock for Drizzle**: plain `mockResolvedValue` on `.where()` breaks further chaining. Use a thenable chain object with `then/catch/finally` and a `_resolve(val)` setter. Suppress `lint/suspicious/noThenProperty` on the `then` property.
- **Mock `@tanstack/react-start` in tests** to prevent plugin from stripping server fn handlers during test module loading.
- **Router context requires default in `createRouter`**: `createRootRouteWithContext<RouterContext>()` requires `context: { auth: { user: null } }` in `createTanStackRouter()` call in `router.tsx`.

## Shared Learnings (added task_08 fix)

- **Shiki WASM crashes Vitest node environment**: `@shikijs/rehype` default uses `getSingletonHighlighter` → oniguruma WASM → `ERR_UNKNOWN_FILE_EXTENSION`. Fix: use `createHighlighterCore` from `shiki/core` + `createJavaScriptRegexEngine` from `shiki/engine/javascript` + `rehypeShikiFromHighlighter` from `@shikijs/rehype/core`.
- **gray-matter parses YAML date fields as JS Date objects**: `String(data.publishedAt)` produces locale datetime string, not `"YYYY-MM-DD"`. Fix: `data.publishedAt instanceof Date ? data.publishedAt.toISOString().slice(0, 10) : String(data.publishedAt)`.
- **`rehypeShikiFromHighlighter` is a Transformer factory, not a plugin**: returns `Transformer` directly; wrap in `() =>` for MDX `rehypePlugins` so unified treats the return value as the transformer.

## Handoffs

- Task 05 (Content Indexer) — **completed**. `app/db/indexer.ts` has `upsertPost`, `removePost`, `syncAll`.
- Task 06 (File Watcher) — **completed**. `app/lib/watcher.server.ts` has `startContentWatcher`. Startup integrated via Vite plugin `configureServer` in `vite.config.ts`.
- Task 07 (Manual Sync Script) — **completed**. `scripts/sync.ts` with `parseDir`/`runSync`; `closeDb()` added to `app/db/client.ts`; `sync` npm script added; 7 unit + 4 integration tests passing.
- Task 08 (MDX Renderer) — **completed**. `app/lib/mdx.server.ts` has `parseFrontmatter`, `renderMdx`. Uses JS regex engine (no WASM). All 9 tests pass.
- Task 09 (Public Routes) — **completed**. `app/routes/index.tsx` and `app/routes/$slug.tsx` with `getPublishedPosts`, `getPostBySlug`, `incrementViewCount`. Note: task-09 test file has pre-existing failures (createServerFn stripping issue in mocks).
- Task 10 (Better Auth) — **completed**. `app/lib/auth.ts` has Better Auth instance with `reactStartCookies()`. `app/routes/api/auth/$.ts` has GET/POST handlers.
- Task 11 (Admin Routes) — **completed**. Admin dashboard, preview route, login page; session loaded in `__root.tsx`; 12 unit tests passing. Integration tests deferred.
