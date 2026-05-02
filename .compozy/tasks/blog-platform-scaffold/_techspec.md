# TechSpec: Blog Platform Scaffold

## Executive Summary

The scaffold implements a full-stack TypeScript blog platform using TanStack Start's SSR model as the execution layer. The architecture centers on a hybrid content model: `.mdx` files in `/content` are the canonical source of truth; a Postgres-backed index (Drizzle ORM) powers all routing queries and admin operations. `@mdx-js/mdx` compiles MDX to React components server-side per request, with Shiki providing syntax highlighting as a rehype plugin at compile time. Better Auth manages admin session state via HttpOnly cookies, with route protection wired through TanStack Router's `beforeLoad` lifecycle.

Primary trade-off: Bun native `fs.watch` for the content watcher (zero runtime dependency, sufficient for macOS/Linux personal use) instead of `chokidar` (cross-platform but adds a dependency). A `bun run sync` script serves as a fallback. All four immature dependencies (TanStack Start v1, React 19, Better Auth, Drizzle) are pinned in the lockfile with an auth-to-database smoke test as the integration guard rail.

## System Architecture

### Component Overview

```
content/                     ← .mdx files (source of truth)
  hello-world.mdx
  another-post.mdx

app/
  routes/
    __root.tsx               ← session loaded into router context
    index.tsx                ← public post list (SSR)
    $slug.tsx                ← public post detail + view counter (SSR)
    admin/
      index.tsx              ← admin dashboard (auth-gated)
      preview.$slug.tsx      ← admin MDX preview (auth-gated)
    api/
      auth/$.ts              ← Better Auth catch-all handler
  lib/
    mdx.server.ts            ← @mdx-js/mdx compile + run
    watcher.server.ts        ← fs.watch content indexer
    auth.ts                  ← Better Auth instance
  db/
    schema.ts                ← Drizzle posts table + Better Auth tables
    client.ts                ← postgres.js connection + Drizzle instance
    indexer.ts               ← upsert/remove logic for content watcher

scripts/
  seed.ts                    ← admin user creation (idempotent)
  sync.ts                    ← manual full-sync fallback

docker-compose.yml           ← Postgres service only (bun dev runs locally)
drizzle.config.ts
biome.json
.lefthook.yml
```

**Data flows:**

- **Write path**: author saves `.mdx` → `fs.watch` fires → `indexer.upsertPost(filePath)` → Postgres `posts` upsert (metadata only, `is_published = false` on first insert)
- **Public read**: route loader → `getPublishedPosts()` / `getPostBySlug(slug)` → Drizzle query → read `.mdx` from disk → `renderMdx(source)` → React SSR → HTML
- **Admin read**: route loader (auth-gated) → `getAllPosts()` → Drizzle query → dashboard render
- **Publish toggle**: admin server function → `db.update(posts).set({ isPublished }).where(eq(posts.id, id))` → immediate effect on next public request
- **View counter**: post detail loader → `db.update(posts).set({ viewCount: sql`view_count + 1` }).where(eq(posts.slug, slug))`

## Implementation Design

### Core Interfaces

```typescript
// app/db/schema.ts — primary domain type
import { pgTable, serial, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  filePath: text('file_path').notNull().unique(), // stable identifier (ADR-002)
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  publishedAt: timestamp('published_at'),
  isPublished: boolean('is_published').notNull().default(false),
  viewCount: integer('view_count').notNull().default(0),
  indexedAt: timestamp('indexed_at').notNull().defaultNow(),
})

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
```

```typescript
// app/lib/mdx.server.ts — MDX compilation contract
export interface PostFrontmatter {
  title: string
  description?: string
  publishedAt?: string  // ISO date string; optional
  slug?: string         // overrides filename-derived slug when present
}

export async function parseFrontmatter(filePath: string): Promise<PostFrontmatter>
export async function renderMdx(source: string): Promise<React.ComponentType>
```

```typescript
// app/db/indexer.ts — content sync operations
export async function upsertPost(filePath: string): Promise<void>
export async function removePost(filePath: string): Promise<void>
export async function syncAll(contentDir: string): Promise<void>
```

### Data Models

**`posts` table** (managed by Drizzle):

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | Internal ID |
| `file_path` | `text` UNIQUE NOT NULL | Stable identifier: `"content/hello-world.mdx"` |
| `slug` | `text` UNIQUE NOT NULL | URL segment: `"hello-world"` |
| `title` | `text` NOT NULL | From frontmatter |
| `description` | `text` | From frontmatter; used for excerpt and OG tag |
| `published_at` | `timestamp` | From frontmatter; null if no date set |
| `is_published` | `boolean` NOT NULL DEFAULT false | Controlled by admin UI only |
| `view_count` | `integer` NOT NULL DEFAULT 0 | Incremented on each public page visit |
| `indexed_at` | `timestamp` NOT NULL DEFAULT now() | Last time the file was indexed |

**Better Auth tables** (created by Better Auth Drizzle adapter on first migration):
- `user`: `id`, `email`, `emailVerified`, `createdAt`, `updatedAt`
- `session`: `id`, `userId`, `expiresAt`, `token`, `ipAddress`, `userAgent`
- `account`: `id`, `userId`, `accountId`, `providerId`, `accessToken`, `refreshToken`

**MDX frontmatter shape** (parsed from each `.mdx` file's YAML block):

```yaml
---
title: Hello World
description: A short post about something interesting.
publishedAt: 2026-05-02
slug: hello-world  # optional; defaults to filename without extension
---
```

### API Endpoints

**TanStack Start server functions** (`createServerFn` — server-only, no HTTP route):

| Function | Auth | Description |
|---|---|---|
| `getPublishedPosts()` | Public | Returns `Post[]` where `is_published = true`, ordered by `published_at DESC` |
| `getPostBySlug(slug)` | Public | Returns `{ post: Post, source: string }` for a published post; 404 if not found or draft |
| `incrementViewCount(id)` | Public | Increments `view_count` for a given post ID |
| `getAllPosts()` | Admin | Returns all `Post[]` (draft + published), ordered by `indexed_at DESC` |
| `togglePublished(id, isPublished)` | Admin | Updates `is_published` and sets `published_at = now()` if publishing |
| `getAdminPreview(slug)` | Admin | Returns `{ post: Post, source: string }` regardless of publish state |

**External HTTP routes:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/*` | Better Auth session reads, OAuth callbacks (not used in V1) |
| `POST` | `/api/auth/*` | Better Auth login, logout, session refresh |

**Better Auth handler** (`app/routes/api/auth/$.ts`):

```typescript
import { auth } from '~/lib/auth'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
})
```

## Integration Points

**Postgres via Docker Compose:**
- Connection string: `postgres://blog:blog@localhost:5432/blog` (local defaults in `.env.example`)
- `docker-compose.yml` runs Postgres only; `bun dev` runs locally against the container
- Health check: `pg_isready -U blog` with 5s interval, 5 retries before app starts
- Startup order: Docker health check passes → `bun run db:migrate` → `bun run db:seed` → `bun dev`

**Better Auth (email + password):**

```typescript
// app/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/integrations/tanstack'
import { db } from './db/client'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()], // MUST be last (ADR-001)
})

export const authClient = createAuthClient()
```

**`vite-env-only` server isolation:**

The following modules must be listed in `vite-env-only` configuration to prevent Vite from bundling them for the client during development:
- `app/lib/mdx.server.ts`
- `app/lib/watcher.server.ts`
- `app/lib/auth.ts`
- `app/db/client.ts`
- `app/db/indexer.ts`

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `app/db/schema.ts` | New | Defines `posts` table; Better Auth tables auto-generated | Write schema; run `drizzle-kit generate` + `migrate` |
| `app/lib/mdx.server.ts` | New | Server-only MDX compiler; high risk if bundled on client | Register in `vite-env-only`; verify client bundle |
| `app/lib/watcher.server.ts` | New | `fs.watch` integration; risk of silent failure or duplicate events | Add 100ms debounce; log watcher start event |
| `app/lib/auth.ts` | New | Better Auth instance; plugin order is critical | `tanstackStartCookies` must be last plugin |
| `app/routes/__root.tsx` | New | Session loaded into router context in `beforeLoad` | Use `getWebRequest()` + `auth.api.getSession()` |
| `docker-compose.yml` | New | Postgres service; timing risk before migrations run | Add health check + `depends_on` with condition |
| `scripts/seed.ts` | New | Admin user creation; must be idempotent | Check for existing user before insert |

## Testing Approach

### Unit Tests

- **`renderMdx()`**: Compile a known MDX string containing a heading, paragraph, and fenced code block. Assert the returned component renders to HTML that includes the heading text and a Shiki-highlighted code block.
- **`parseFrontmatter()`**: Parse a fixture `.mdx` file with all frontmatter fields set. Assert `title`, `description`, `publishedAt`, and `slug` match expected values. Parse a file with no `slug` field; assert slug is derived from the filename.
- **`upsertPost()`**: Mock `db`. Call with a valid `.mdx` file path. Assert `db.insert().onConflictDoUpdate()` is called with correct field values.
- **`removePost()`**: Mock `db`. Call with a file path. Assert `db.delete().where()` is called.
- **Watcher debounce**: Mock `fs.watch` to emit two rapid `change` events for the same file. Assert `upsertPost` is called exactly once after the debounce delay.

### Integration Tests

- **Auth round trip**: Seed admin user → POST to `/api/auth/sign-in` → verify session cookie set → GET `/admin` → assert 200 (not redirect)
- **Publish flow**: Insert a post row with `is_published = false` → call `togglePublished(id, true)` → GET `/$slug` → assert 200 and content rendered
- **Draft protection**: Insert a post with `is_published = false` → GET `/$slug` → assert 404
- **View counter**: GET `/$slug` twice → query `view_count` → assert value is 2
- **File-to-index**: Write a `.mdx` file to `content/` in the test directory → wait 200ms → query `posts` → assert row exists with correct slug and title

### Smoke Test

Run after `docker compose up`:

1. `bun run db:migrate` — assert exit 0
2. `bun run db:seed` — assert exit 0, assert admin user exists in DB
3. `bun dev` (background) — assert dev server responds to `GET http://localhost:3000` within 10s
4. POST `/api/auth/sign-in` with seeded credentials — assert session cookie in response
5. GET `/admin` with session cookie — assert 200
6. `biome check .` — assert exit 0

## Development Sequencing

### Build Order

1. **Project initialization** — `bunx create-tanstack-start@latest`, add `biome.json`, `.lefthook.yml`, `.env.example`. No dependencies.
2. **Docker Compose** — `docker-compose.yml` with Postgres service, health check, and env defaults. Depends on step 1.
3. **Drizzle schema + migrations** — `app/db/schema.ts` (posts table), `app/db/client.ts` (postgres.js connection), `drizzle.config.ts`, `bun run db:generate`, `bun run db:migrate`. Depends on step 2.
4. **Seed script** — `scripts/seed.ts` (idempotent admin user creation). Depends on step 3.
5. **Content indexer** — `app/db/indexer.ts` (`upsertPost`, `removePost`, `syncAll`). Depends on step 3.
6. **File watcher** — `app/lib/watcher.server.ts` (debounced `fs.watch` calling indexer). Depends on step 5.
7. **Sync script** — `scripts/sync.ts` (manual full-sync fallback). Depends on step 5.
8. **MDX renderer** — `app/lib/mdx.server.ts` (`parseFrontmatter`, `renderMdx` with Shiki). Depends on step 1 (npm deps only).
9. **Public routes** — `app/routes/index.tsx` (post list) and `app/routes/$slug.tsx` (post detail + view counter). Depends on steps 3, 5, 8.
10. **Better Auth** — `app/lib/auth.ts`, `app/routes/api/auth/$.ts`, update `__root.tsx` to load session. Depends on step 3.
11. **Admin routes** — `app/routes/admin/index.tsx` (dashboard), `app/routes/admin/preview.$slug.tsx`. Depends on steps 9, 10.
12. **Integration + smoke tests** — auth round trip, publish flow, view counter, `docker compose up` smoke test. Depends on all above.

### Technical Dependencies

- Docker and Bun must be installed on the developer's machine before step 2
- `bun run db:migrate` must run before `bun dev` (Drizzle migrations create the tables Better Auth's adapter expects)
- `bun run db:seed` must run after `db:migrate` and before first admin login
- Watcher startup must be integrated with TanStack Start / Vinxi app lifecycle — requires validation that `startContentWatcher()` can be called as a module-level side effect in a server entry point without triggering client-side bundling (see Known Risks)

## Monitoring and Observability

**Structured log events** (console output, no external service in V1):

| Event | Level | Fields |
|---|---|---|
| Watcher started | INFO | `contentDir`, timestamp |
| File indexed | INFO | `filePath`, `slug`, `action: 'added'\|'updated'\|'removed'` |
| File index error | ERROR | `filePath`, `error` message |
| Admin login success | INFO | `email`, `sessionId` |
| Admin login failure | WARN | `email`, `reason` |
| MDX compile error | ERROR | `filePath`, `error` message |
| Migration complete | INFO | `migrationsRun`, timestamp |

**Key operational checks:**
- Watcher emits at least one event within 5 seconds of startup — if not, log a WARNING: `[watcher] No files indexed on startup — check content/ directory`
- `docker compose up` health check on Postgres before any migration command

## Technical Considerations

### Key Decisions

**`postgres.js` as Drizzle driver** (from ADR-001): `pg` (node-postgres) has native module bindings that are not guaranteed to work in Bun. `postgres.js` is a pure JavaScript driver with confirmed Bun compatibility.

**File path as stable post identifier** (from ADR-002): The frontmatter `slug` field can change across edits without the developer expecting a database identity change. The file path within the repo is stable. Slug is derived from frontmatter (if set) or from the filename (as fallback) and stored separately. Slug uniqueness is enforced at the database level.

**Watcher started as module-level side effect**: `startContentWatcher()` is called in a server-only module that is imported by the app's SSR entry point. This must be guarded by a `vite-env-only` import to prevent it from running in the client bundle. The exact Vinxi/TanStack Start hook for app startup is confirmed during step 6 of the build order.

**Admin seed is idempotent**: `scripts/seed.ts` checks for an existing user with `ADMIN_EMAIL` before inserting. Running it twice produces no error and no duplicate user.

### Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `fs.watch` recursive mode not working on Windows | Medium | Documented limitation; `bun run sync` fallback; chokidar upgrade path documented in code |
| Watcher startup integration with Vinxi lifecycle | Medium | Validate in step 6 prototype before building dependent routes; fallback is `bun run sync` |
| TanStack Start server function API change before build completes | Low | All four risky dependencies pinned in lockfile; upgrade only intentionally |
| `@mdx-js/mdx` `run()` `baseUrl` required in Bun ESM | Low | Include `baseUrl: import.meta.url` in `run()` call; test with a fixture `.mdx` file in step 8 |
| Drizzle schema migration conflicts with Better Auth adapter tables | Low | Better Auth Drizzle adapter uses its own migration step or generates its own schema file; run both migrations in order and verify no column conflicts |

## Architecture Decision Records

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — Full starter kit with mandatory guard rails; pinned versions and smoke test required
- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — Hybrid file-based content; file path as stable identifier; admin owns publish state
- [ADR-003: MDX Compilation — @mdx-js/mdx Direct](adrs/adr-003.md) — `compile()` + `run()` with Shiki rehype plugin; enforces server-only boundary
- [ADR-004: File Watcher — Bun Native fs.watch](adrs/adr-004.md) — Zero-dependency watcher with 100ms debounce; `bun run sync` as fallback
