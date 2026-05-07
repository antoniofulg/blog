---
title: "TASK-0004 TechSpec: Code Organization, Agent Tooling & Security Audit"
slug: 004-code-org-security
status: approved
date: 2026-05-06
---

## Executive Summary

This TechSpec translates PRD-0004 into an atomic set of file moves, extractions,
and documentation additions. No new runtime dependencies are required. The primary
technical trade-off is the `PostFrontmatter` type divergence: a single canonical
type with `publishedAt?: string` is adopted for display use, while `indexer.ts`
retains an inlined Date-typed shape for Drizzle insert compatibility (ADR-003).
All changes are fully type-checked by `tsc --noEmit` before merge.

## System Architecture

```
Before                              After
──────────────────────────────      ──────────────────────────────────────────────
app/
  lib/
    mdx.server.ts               →   lib/
    auth.ts                           mdx/
    auth.client.ts                      parser.server.ts   ← parseFrontmatter
    watcher.server.ts                   renderer.server.ts ← renderMdx
    theme.tsx                         auth.ts
                                      auth.client.ts
  routes/                             session.ts           ← requireSession (NEW)
    admin/                            watcher.server.ts
      index.tsx                       theme.tsx
      preview.$slug.tsx
                                  routes/
                                    admin/
                                      index.tsx                    ← route + UI only
                                      index.server.ts              ← NEW: server fns
                                      preview.$slug.tsx            ← route + UI only
                                      preview.$slug.server.ts      ← NEW: server fns

                                  types/                  ← NEW directory
                                    content.ts            ← PostFrontmatter
                                    auth.ts               ← AuthUser, RouterContext
```

No new npm packages. Path alias `#/*` resolves to `./app/*` (unchanged).

## Core Interfaces

### `app/types/content.ts`

```typescript
export type PostFrontmatter = {
  title: string;
  description?: string;
  publishedAt?: string; // ISO 8601
  slug?: string;
};
```

### `app/types/auth.ts`

```typescript
export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type RouterContext = {
  auth: { user: AuthUser | null };
};
```

### `app/lib/session.ts`

```typescript
import { auth } from "#/lib/auth";
import { getRequest } from "@tanstack/react-start/server";

export async function requireSession(): Promise<void> {
  const session = await auth.api.getSession({
    headers: getRequest().headers,
  });
  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
```

### `app/lib/mdx/parser.server.ts`

```typescript
import type { PostFrontmatter } from "#/types/content";

export async function parseFrontmatter(
  filePath: string
): Promise<PostFrontmatter>;
```

`parseFrontmatter` moves verbatim from `mdx.server.ts:44-67`. Return type
annotation updated to import from `#/types/content`.

### `app/lib/mdx/renderer.server.ts`

```typescript
import type { ComponentType } from "react";

export async function renderMdx(source: string): Promise<ComponentType>;
```

`renderMdx` moves verbatim from `mdx.server.ts:69-83`. No type changes.

### `app/routes/admin/index.server.ts`

```typescript
export async function getAllPostsFn(): Promise<Post[]>;
export async function togglePublishedFn(
  id: number,
  isPublished: boolean
): Promise<void>;
export const getAllPosts: ReturnType<typeof createServerFn>;
export const togglePublished: ReturnType<typeof createServerFn>;
```

### `app/routes/admin/preview.$slug.server.ts`

```typescript
export async function getAdminPreviewFn(
  slug: string,
  renderFn?: (source: string) => Promise<ComponentType>
): Promise<{ post: Post; html: string }>;
export const getAdminPreview: ReturnType<typeof createServerFn>;
```

## File-by-File Changes

### New files (create)

| File | Contents |
|---|---|
| `app/types/content.ts` | `PostFrontmatter` type (see Core Interfaces) |
| `app/types/auth.ts` | `AuthUser`, `RouterContext` types moved from `__root.tsx` |
| `app/lib/session.ts` | `requireSession()` (see Core Interfaces) |
| `app/lib/mdx/parser.server.ts` | `parseFrontmatter` moved from `mdx.server.ts` |
| `app/lib/mdx/renderer.server.ts` | `renderMdx` moved from `mdx.server.ts` |
| `app/routes/admin/index.server.ts` | `getAllPostsFn`, `togglePublishedFn`, `getAllPosts`, `togglePublished` moved from `admin/index.tsx` |
| `app/routes/admin/preview.$slug.server.ts` | `getAdminPreviewFn`, `getAdminPreview` moved from `preview.$slug.tsx` |
| `.compozy/tasks/004-code-org-security/SECURITY-FINDINGS.md` | Security audit report (5 findings) |
| `AGENTS.md` | Root agent documentation (≤200 lines) |
| `.agents/rules/auth.md` | Auth domain rules |
| `.agents/rules/routes.md` | Route structure rules |
| `.agents/rules/db.md` | DB layer rules |
| `.agents/rules/components.md` | Component layer rules |

### Modified files (update imports / remove declarations)

| File | Change |
|---|---|
| `app/lib/mdx.server.ts` | **Delete** — replaced by `app/lib/mdx/` directory |
| `app/db/indexer.ts` | Remove `interface PostFrontmatter`; `parseFrontmatterBlock` uses inlined return type `{ title: string; description?: string; publishedAt?: Date; slug?: string }` |
| `app/routes/__root.tsx` | Remove `AuthUser` and `RouterContext` type definitions; add imports from `#/types/auth` |
| `app/routes/admin/index.tsx` | Remove all exports except `Route`; import server fns from `./index.server`; remove inline `requireSession` |
| `app/routes/admin/preview.$slug.tsx` | Remove all exports except `Route`; import server fn from `./preview.$slug.server`; remove inline `requireSession` |
| `app/routes/$slug.tsx` | Update `renderMdx` import to `#/lib/mdx/renderer.server` |
| `app/components/ui/table-of-contents.tsx` | `export interface TocItem` → `export type TocItem =` |
| `app/router.tsx` | Add import of `RouterContext` from `#/types/auth`; keep `interface Register` (TanStack Router module augmentation — required) |

### CLAUDE.md symlink

```bash
ln -s AGENTS.md CLAUDE.md
```

Run from repo root. Verify with `ls -la CLAUDE.md`.

## AGENTS.md Structure

```markdown
# Blog — Agent Context

Personal blog. TanStack Start + TanStack Router + Better Auth + Drizzle ORM
+ PostgreSQL + Tailwind CSS v4. Deployed via Docker on VPS. CI/CD: GitHub Actions.

## Stack
- Runtime: Bun
- Framework: TanStack Start (React, SSR)
- Routing: TanStack Router (file-based)
- Auth: Better Auth (email+password, reactStartCookies plugin)
- DB: Drizzle ORM + PostgreSQL (drizzle-kit migrations)
- Styling: Tailwind CSS v4
- MDX: @mdx-js/mdx + gray-matter + Shiki

## File Structure
app/
  components/layout/  — header, footer shells
  components/ui/      — pure presentational, no route/DB imports
  db/                 — schema.ts (definitions only), queries.ts, indexer.ts, client.ts
  lib/                — auth.ts, auth.client.ts, session.ts, mdx/, watcher.server.ts
  lib/mdx/            — parser.server.ts (frontmatter), renderer.server.ts (compile)
  routes/             — file-based routes; admin/ and api/ subdirs
  routes/admin/       — *.tsx (UI only) + *.server.ts (server fns)
  types/              — content.ts, auth.ts (shared TypeScript types)
  styles/             — global.css
  tests/              — unit + integration tests

## Key Conventions
- Branch: TASK-XXXX/slug or hotfix/slug
- Commits: Conventional Commits (feat/fix/chore/docs/test/refactor/ci)
- TypeScript: use `type` for all shapes; `interface` only for class implements
  or module augmentation (e.g., TanStack Router Register)
- Server fns: extract to *.server.ts co-located with route file
- Auth: always call requireSession() from #/lib/session at top of server fn handlers
- Types: shared types live in app/types/ — never define exported types in route files

## Skill Map
| Task type | Skills to activate |
|---|---|
| New route | tanstack-router, tanstack-start-best-practices, find-rules |
| Auth change | better-auth-best-practices, better-auth-security-best-practices, find-rules |
| DB schema/query | drizzle-postgres, drizzle-orm, find-rules |
| UI component | react, shadcn, tailwindcss, building-components |
| Refactor | no-workarounds, refactoring-analysis, find-rules |
| Security | better-auth-security-best-practices, no-workarounds |
| CI/CD | find-rules (see .agents/rules for cicd.md and git-workflow.md) |

## Rules
- Auth: .agents/rules/auth.md
- Routes: .agents/rules/routes.md
- DB: .agents/rules/db.md
- Components: .agents/rules/components.md
- Git workflow: .agents/rules/git-workflow.md
- CI/CD: .agents/rules/cicd.md
```

## Domain Rule Files Content

### `.agents/rules/auth.md`

```markdown
# Auth Rules

## Required pattern
Every server function handler that accesses protected data MUST call requireSession()
as its first statement:

    import { requireSession } from "#/lib/session";
    const handler = createServerFn(...).handler(async () => {
      await requireSession();
      // data access here
    });

## Prohibited
- Client-side auth checks as the only guard (context.auth.user check in beforeLoad
  is UI-only; server must re-verify)
- Inline requireSession definitions in route files — always import from #/lib/session
- Hardcoded credentials in any file (including fallback strings in env access)
- Storing secrets in Docker image or workflow files — use GitHub Secrets / .env

## Better Auth conventions
- auth instance: app/lib/auth.ts (server only)
- auth client: app/lib/auth.client.ts (client only)
- reactStartCookies plugin MUST be last in the plugins array (ADR-001 in blog scaffold)
- Auth API route: app/routes/api/auth/$.ts — do not add custom logic here

## DAL pattern
Authentication is enforced at the data access layer (inside server fns), NOT only
at the route boundary. beforeLoad redirects are UX; requireSession() is the security gate.
```

### `.agents/rules/routes.md`

```markdown
# Route Rules

## File structure
Each route in app/routes/admin/ follows the two-file pattern:
- *.tsx        — route config (createFileRoute), beforeLoad, loader wiring, React components
- *.server.ts  — createServerFn definitions, raw DB access functions, requireSession calls

Public routes ($slug.tsx, blog.tsx, etc.) may keep server fns inline if the file
stays under ~80 lines and has <= 2 server fns. Extract when either limit is exceeded.

## Naming
- Route files: TanStack Router convention (flat dot-separated or directory)
- Server fn files: same basename as route + .server.ts suffix
  - admin/index.tsx => admin/index.server.ts
  - admin/preview.$slug.tsx => admin/preview.$slug.server.ts

## Allowed in *.tsx route files
- createFileRoute() call
- beforeLoad, loader, component, errorComponent, pendingComponent options
- React component definitions (function components only)
- Imports from #/lib, #/types, #/components, and the co-located *.server.ts

## Prohibited in *.tsx route files
- createServerFn() calls
- Direct db.* imports (drizzle-orm queries)
- Business logic functions (non-component, non-hook)
- Exported async functions that are not React components or hooks

## routeTree.gen.ts
This file is auto-generated by TanStack Router. Never edit manually. Run the dev
server or `bunx tsr generate` to regenerate after adding/moving route files.
```

### `.agents/rules/db.md`

```markdown
# DB Rules

## File responsibilities
- app/db/schema.ts       — pgTable definitions ONLY; no query logic, no business logic
- app/db/queries.ts      — exported query functions for public (reader) data access
- app/db/indexer.ts      — file-to-DB pipeline: reads file, parses frontmatter, upserts post
- app/db/client.ts       — drizzle client singleton; imports DATABASE_URL from env
- app/db/auth-schema.ts  — Better Auth table definitions (managed by better-auth)

## Type placement
Shared TypeScript types for DB-related shapes belong in app/types/, not in schema.ts
or queries.ts. Exception: Drizzle inferred types ($inferSelect, $inferInsert) are
defined inline where the schema is declared.

## Query function rules
- All public query functions go in queries.ts
- Admin/write operations go in the co-located *.server.ts file (not in queries.ts)
- No raw SQL strings — use Drizzle query builder or sql`` tagged template

## Anti-patterns
- Business logic inside schema.ts (hooks, computed fields)
- Direct db.* calls inside React components or layout files
- Exporting db client from anywhere other than #/db/client
- Duplicate type definitions (PostFrontmatter was duplicated — resolved in ADR-003)
```

### `.agents/rules/components.md`

```markdown
# Component Rules

## Layer boundary
Components in app/components/ MUST NOT import from:
- app/routes/ (any route file)
- app/db/ (any DB file)

Allowed imports: #/lib/theme, #/types/*, external packages, other #/components/*.

## TypeScript
- Prop types: use `type Props = { ... }` — never `interface Props`
- Export prop types only if consumed by a parent component or test
- Prefer inline prop types for simple components (<=3 props)

## Structure
- app/components/layout/ — page shells (header, footer); one component per file
- app/components/ui/     — reusable UI elements; pure presentational
- No CSS modules — use Tailwind utility classes only

## Anti-patterns
- Components that call createServerFn() directly
- Components with useEffect that fetches data (use loader + Route.useLoaderData())
- Components importing auth client (#/lib/auth.client) for session checks
- Barrel index.ts files in components/ directories
```

## Security Findings Report Structure

`SECURITY-FINDINGS.md` documents these 5 findings:

| ID | Severity | File | Risk | Recommended Fix |
|---|---|---|---|---|
| SEC-001 | High | `app/lib/auth.ts` | No rate limiting on auth endpoints — brute-force risk | Add `rateLimit` plugin to Better Auth config; swap in-memory store for persistent store before high-traffic |
| SEC-002 | Medium | `app/routes/login.tsx:46` | `result.error.message` exposed to client — email enumeration possible | Return generic "Invalid credentials" regardless of error type |
| SEC-003 | High | `app/db/client.ts:7` | `DATABASE_URL` fallback `postgres://blog:blog@...` — silent connection to default-credential DB if env absent | Remove fallback; throw on missing `DATABASE_URL`; add env validation module |
| SEC-004 | Medium | `app/routes/admin/index.tsx:47` | `inputValidator` passes input without bounds check — negative `id` accepted | Add validation: `id` must be positive integer |
| SEC-005 | Low | `app/routes/api/auth/$.ts` | No request body size limit on auth handler — potential DoS vector | Add body size limit via Nitro config or middleware |

## Development Sequencing

Build order (each step depends on the previous unless noted):

1. **Create `app/types/content.ts`** — no dependencies; establishes canonical `PostFrontmatter`
2. **Create `app/types/auth.ts`** — no dependencies; move `AuthUser`, `RouterContext` from `__root.tsx`
3. **Create `app/lib/session.ts`** — depends on `#/lib/auth` (existing); no new type imports needed for void variant
4. **Create `app/lib/mdx/parser.server.ts`** — depends on step 1 (`PostFrontmatter` import); move `parseFrontmatter` from `mdx.server.ts`
5. **Create `app/lib/mdx/renderer.server.ts`** — no type dependencies; move `renderMdx` from `mdx.server.ts`
6. **Delete `app/lib/mdx.server.ts`** — depends on steps 4+5 being complete; run `tsc --noEmit` immediately after
7. **Update `app/db/indexer.ts`** — remove `interface PostFrontmatter`; inline return type; no import changes needed
8. **Create `app/routes/admin/index.server.ts`** — depends on step 3 (`requireSession` import); move server fns from `admin/index.tsx`
9. **Create `app/routes/admin/preview.$slug.server.ts`** — depends on step 3 and step 5 (`renderMdx` import)
10. **Update `app/routes/admin/index.tsx`** — depends on step 8; remove server fns, add import from `./index.server`
11. **Update `app/routes/admin/preview.$slug.tsx`** — depends on step 9; remove server fns, add import from `./preview.$slug.server`
12. **Update `app/routes/__root.tsx`** — depends on step 2; remove type definitions, add imports from `#/types/auth`
13. **Update `app/routes/$slug.tsx`** — depends on step 5; update `renderMdx` import to `#/lib/mdx/renderer.server`
14. **Update `app/components/ui/table-of-contents.tsx`** — independent; convert `interface TocItem` to `type TocItem =`
15. **Run `tsc --noEmit`** — verify all import paths valid; fix any broken references before proceeding
16. **Create `AGENTS.md`** — depends on steps 1-15 being complete (documents actual implemented patterns)
17. **Create `CLAUDE.md` symlink** — depends on step 16 (`ln -s AGENTS.md CLAUDE.md`)
18. **Create `.agents/rules/{auth,routes,db,components}.md`** — depends on steps 1-15 (rules reflect actual code)
19. **Write `SECURITY-FINDINGS.md`** — independent; can run in parallel with steps 16-18
20. **Run `make test`** — depends on all previous steps; must pass before opening PR

## Testing

No new test files required. All changes are structural (file moves, import updates,
type changes). Existing test suite provides coverage.

| Check | Command | What it catches |
|---|---|---|
| Type correctness | `tsc --noEmit` | Broken imports, type mismatches after moves |
| Lint | `make lint` | `interface` gaps, import direction violations |
| Unit + integration | `make test` | Regression in `admin-routes.test.ts`, `auth.test.ts`, `mdx.test.ts`, `auth-integ.test.ts`, `mdx-integ.test.ts` |

Run `tsc --noEmit` after step 6 (delete `mdx.server.ts`) to catch missed import
sites immediately.

## Architecture Decision Records

- [ADR-001: V1 scope bounded to server fn extraction + shared auth util + docs](adrs/adr-001.md)
- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md)
- [ADR-003: PostFrontmatter canonical type uses `publishedAt?: string`; indexer retains inlined Date type](adrs/adr-003.md)
- [ADR-004: `requireSession` uses throw-only pattern (`Promise<void>`)](adrs/adr-004.md)
- [ADR-005: MDX directory uses direct imports, no barrel file](adrs/adr-005.md)
