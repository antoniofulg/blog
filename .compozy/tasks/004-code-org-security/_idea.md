---
title: Code Organization (SOLID) + Agent Tooling + Security Audit
slug: code-org-security
status: draft
date: 2026-05-06
---

## Overview

Refactor the blog codebase to enforce SOLID principles across all layers, create
agent-readable documentation (AGENTS.md + CLAUDE.md symlink), establish domain
rule files covering code patterns and file/folder structure, migrate TypeScript
`interface` to `type` across non-class code, and produce a structured security
findings report for auth, login, and admin.

## Problem

**Structural debt (4 months in):**
- 6 confirmed SOLID violations: server functions, data loaders, and UI components
  co-located in same files across admin, MDX, and watcher layers
- `requireSession()` duplicated in 2+ route files with no shared utility
- `PostFrontmatter` interface duplicated across `mdx.server.ts` and `indexer.ts`
- No `app/types/` or `app/utils/` directories — types scattered across routes
- `interface` used instead of `type` in 3 non-class files (TanStack Router module
  augmentation in `router.tsx` is the only valid exception)

**Agent tooling gap:**
- No CLAUDE.md or AGENTS.md at repo root — every AI session re-discovers architecture
- No skill map — agents don't know which tools to use for which task type
- No project-specific rules for code patterns, file/folder structure, or TypeScript
  conventions to enforce quality on future features

**Security surface (findings report; fixes in separate task):**
- No rate limiting on Better Auth endpoints (in-memory default, not configured)
- Login error messages expose `result.error.message` — email enumeration risk
- `DATABASE_URL` accessed with hardcoded fallback credentials
- `inputValidator` on admin toggle endpoint lacks bounds checking
- No request size limits on `api/auth/$` handler

## Core Features

| Priority | Feature | Description |
|---|---|---|
| 1 | Server function extraction | Extract server fns from `admin/index.tsx` → `admin/index.server.ts`; same for `preview.$slug.tsx` |
| 2 | Shared session utility | Create `app/lib/session.ts` with `requireSession()` — single source of truth |
| 3 | Types directory | Create `app/types/content.ts` with `PostFrontmatter`; consolidate scattered types |
| 4 | MDX concern split | Split `mdx.server.ts` into parser and renderer — reduce 4-concern file to 2 |
| 5 | `interface` → `type` migration | Replace `interface` with `type` in `table-of-contents.tsx`, `mdx.server.ts` (then moved to `app/types/`). Remove duplicate in `indexer.ts`. Keep `interface` only for class `implements` and module augmentation (e.g., `router.tsx:17`) |
| 6 | AGENTS.md + CLAUDE.md | Root AGENTS.md (≤200 lines) with project context + skill map per task type; CLAUDE.md symlinks to AGENTS.md |
| 7 | Domain rule files | `.agents/rules/` files per domain (auth, routes, db, components) each covering: code patterns, file/folder structure conventions, naming rules, TypeScript typing convention, anti-patterns |
| 8 | Security findings report | Structured report of 5 security findings with severity, location, recommended fix |

## KPIs

| KPI | Baseline | Target |
|---|---|---|
| SOLID violations (critical) | 6 | 0 after refactor |
| `requireSession` copies | 2+ inline | 1 shared utility |
| `interface` in non-class/non-augmentation code | 3 | 0 |
| Agent context messages to understand architecture | ~5 | ≤2 |
| Rule files covering project domains | 0 | 4 (auth, routes, db, components) |
| Security findings documented | 0 | 5 (all identified items) |
| Next-feature SOLID compliance | Unknown | 100% (enforced by rules) |

## Feature Assessment

| Criteria | Score | Rationale |
|---|---|---|
| Impact | Must do | Structural debt blocks safe extension of every route; agent tooling pays compound interest |
| Reach | Must do | Every future file inherits these patterns |
| Frequency | Strong | Daily agent sessions amplify AGENTS.md value |
| Differentiation | Strong | DAL pattern + agent-native docs is rare for personal blogs |
| Defensibility | Strong | Rules self-enforce via agent context in every session |
| Feasibility | Must do | All local file edits; no external dependencies |

## Council Insights

- **Extract only where friction is real** (pragmatic-engineer + devils-advocate):
  Target files with ≥3 concerns: `admin/index.tsx`, `mdx.server.ts`. Leave `$slug.tsx`
  borderline split as V2 decision.
- **DAL pattern via convention** (architect-advisor): Shared `requireSession` util is the
  right V1 DAL implementation. Bake into `.agents/rules/auth.md` as required convention.
- **Security vulns stay open** (security-advocate): Acceptable for single-admin personal
  blog. Non-negotiable: document all findings clearly so security task is well-scoped.
- **AGENTS.md depth** (resolved): Root file with skill map + summary links to domain
  rule files. Under 200 lines for root file.
- **`type` over `interface`** (architect-advisor): Enforced as project-wide TypeScript
  convention. Exceptions: class `implements` contracts and TanStack Router-style
  module augmentation (declaration merging).

## File/Folder Structure (Target State)

```
app/
  components/
    layout/       # header, footer (layout shells only)
    ui/           # pure presentational components, no route/DB imports
  db/
    schema.ts     # table definitions only
    queries.ts    # query functions only
    indexer.ts    # file→DB pipeline (fs + parse + upsert)
    client.ts     # DB client singleton
    auth-schema.ts
  lib/
    auth.ts       # Better Auth instance config
    auth.client.ts
    session.ts    # NEW: shared requireSession() utility
    mdx/          # NEW: split from mdx.server.ts
      parser.server.ts   # frontmatter parsing
      renderer.server.ts # MDX compilation + React rendering
    watcher.server.ts
    theme.tsx
  routes/
    admin/
      index.tsx            # route + UI only
      index.server.ts      # NEW: server fns (getAllPosts, togglePublished)
      preview.$slug.tsx    # route + UI only
      preview.$slug.server.ts  # NEW: server fns
    api/auth/$.ts
    __root.tsx
    [public routes]
  types/           # NEW
    content.ts     # PostFrontmatter, shared content types
  styles/
    global.css
  tests/
  router.tsx
  routeTree.gen.ts
```

## TypeScript Convention

- Use `type` for all data shapes, union types, intersection types, function signatures
- Use `interface` ONLY for:
  1. Class `implements` contracts
  2. Module augmentation (declaration merging) — e.g., TanStack Router `Register`
- Never use `interface` for plain object shapes — use `type X = { ... }` instead

## Out of Scope (V1)

| Item | Justification |
|---|---|
| Env validation module (`app/lib/env.ts`) | Code change; belongs in security task |
| Redis rate limiting swap | Infrastructure; rule documented, implementation deferred |
| Full `watcher.server.ts` restructure | Complex pipeline; risk of breaking indexer |
| Role-based permissions in auth schema | No multi-user requirement today |
| Security fixes (rate limiting, error hardening, input validation) | Dedicated security task |
| Automated SOLID linting (Biome custom rules) | V2 after rules are validated |
| `$slug.tsx` server fn extraction | Borderline case; V2 decision |

## Architecture Decision Records

- [ADR-001: Scope bounded to server fn extraction + shared auth util + docs](adrs/adr-001.md)

## Open Questions

1. Should `mdx.server.ts` split into `mdx/parser.server.ts` + `mdx/renderer.server.ts`
   (directory), or stay as two flat files `mdx.parser.server.ts` + `mdx.renderer.server.ts`?
2. After security task: should Better Auth rate limiting use Redis or Drizzle-backed store?
3. Should the security findings report live in `.compozy/tasks/code-org-security/` or
   as a standalone `SECURITY.md` at repo root?
4. Should `watcher.server.ts` get a rule prohibiting direct DB calls
   (use callback/interface pattern), or is that over-engineering for V1?
