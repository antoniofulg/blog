---
title: "TASK-0004: Code Organization, Agent Tooling & Security Audit"
slug: 004-code-org-security
status: approved
date: 2026-05-06
---

## Overview

Establish a structural and documentation baseline for the blog codebase. This task
refactors four layers to follow SOLID's single-responsibility principle, migrates
TypeScript interfaces to types, creates agent-readable documentation (AGENTS.md +
CLAUDE.md), publishes per-domain quality rules, and produces a security findings
report for the auth surface. All deliverables ship in a single atomic PR.

**Why now:** The codebase is four months old with six confirmed SOLID violations.
Every new route risks inheriting the same structural debt. No agent documentation
exists, so each Claude session re-discovers the architecture. Five security issues
are unaddressed. Fixing these now costs far less than fixing them after five more
features compound the debt.

## Goals

1. Eliminate all six confirmed SOLID violations across admin routes, MDX lib, and the
   indexer layer.
2. Create a single shared session authentication utility (eliminating duplication).
3. Establish `app/types/` as the canonical home for shared TypeScript types.
4. Replace all non-class `interface` declarations with `type` across `app/`.
5. Create AGENTS.md at repo root so any AI agent can orient itself in ≤2 messages.
6. Publish four domain rule files that enforce quality standards on future features.
7. Produce a structured security findings report for the auth, login, and admin
   surfaces, scoped for a dedicated security hardening task.

## User Stories

**As the blog developer (Antonio),** I want server logic separated from UI in admin
routes so I can read, test, and extend each concern independently without scrolling
through a 150-line mixed file.

**As the blog developer,** I want a single `requireSession()` function in one file
so I never have to remember which route file has the "correct" copy or worry about
them diverging.

**As the blog developer,** I want all shared TypeScript types in `app/types/` so I
can find any type definition in one predictable place rather than hunting across
route files and lib files.

**As the blog developer,** I want `type` instead of `interface` for all plain data
shapes so the codebase follows one consistent TypeScript idiom and future contributors
know the convention without asking.

**As an AI agent (Claude) starting a new session,** I want to read AGENTS.md and
immediately know the project tech stack, file structure, skill map, and key rules
so I can make correct decisions without requesting repeated context.

**As the blog developer,** I want per-domain rule files in `.agents/rules/` so that
any future feature — auth change, new route, DB query, new component — has explicit
quality standards to follow.

**As the blog developer,** I want a security findings report that lists every known
vulnerability with severity, location, and recommended fix so I can create a focused
security task without re-auditing the codebase from scratch.

## Core Features

### F1 — Admin Route Server Function Extraction

Extract all `createServerFn` calls and raw database access functions out of
`admin/index.tsx` and `admin/preview.$slug.tsx` into co-located `.server.ts` files.
The route files retain only route configuration, `beforeLoad`, `loader` wiring, and
React components.

Scope:
- `admin/index.tsx` → extracts to `admin/index.server.ts`
- `admin/preview.$slug.tsx` → extracts to `admin/preview.$slug.server.ts`

### F2 — Shared Session Utility

Create `app/lib/session.ts` containing a single `requireSession()` function. Remove
the inline copies from `admin/index.tsx` and `admin/preview.$slug.tsx`. All current
and future server functions that need authentication import from this one file.

### F3 — Types Directory

Create `app/types/content.ts` with the canonical `PostFrontmatter` type definition.
Move `AuthUser` type from `__root.tsx` to `app/types/auth.ts`. All existing imports
update to point to the new locations.

### F4 — MDX Library Split

Split `app/lib/mdx.server.ts` into a directory `app/lib/mdx/` with two files:
- `parser.server.ts` — frontmatter extraction from file paths
- `renderer.server.ts` — MDX source compilation to React component

Each file exports only its own concern. Callers update imports accordingly.

### F5 — TypeScript `interface` → `type` Migration

Replace every non-class `interface` declaration in `app/` with `type X = { ... }`.
Exceptions preserved: TanStack Router `interface Register` in `router.tsx`
(module augmentation / declaration merging — framework requirement).

Affected files:
- `app/components/ui/table-of-contents.tsx` — `TocItem`
- `app/lib/mdx.server.ts` — `PostFrontmatter` (migrated and moved to `app/types/`)
- `app/db/indexer.ts` — duplicate `PostFrontmatter` (removed entirely)

### F6 — AGENTS.md + CLAUDE.md

Create `AGENTS.md` at repo root (≤200 lines) containing:
- One-line project description and tech stack
- File/folder structure map with per-directory purpose
- Skill map: which skills to activate per task type (auth work, DB work, UI work, etc.)
- Link index to `.agents/rules/` domain files
- Key conventions (branch naming, commit format, TypeScript idioms)

Create `CLAUDE.md` at repo root as a symlink to `AGENTS.md` so Claude Code's
automatic context injection reads the same source of truth.

### F7 — Domain Rule Files

Create four files in `.agents/rules/`:

**`auth.md`** — covers: requireSession usage, session check placement (server side only),
Better Auth plugin conventions, DAL pattern requirement, anti-patterns (client-only auth
checks, hardcoded credentials).

**`routes.md`** — covers: server fn extraction convention (`*.server.ts` co-location),
route file allowed contents (route config, beforeLoad, loader wiring, components only),
file naming patterns, anti-patterns (business logic in components, mixed server/UI files).

**`db.md`** — covers: schema-only `schema.ts` rule, query function placement in
`queries.ts`, indexer as pipeline file (not a query util), type definitions belong in
`app/types/`, anti-patterns (inline SQL in routes, business logic in schema file).

**`components.md`** — covers: import direction rule (components must not import from
routes/ or db/), `type` over `interface` for prop types, co-location of styles via
Tailwind classes (no external CSS modules), anti-patterns (components with side effects,
direct DB access).

### F8 — Security Findings Report

Produce `SECURITY-FINDINGS.md` in `.compozy/tasks/004-code-org-security/` documenting
all five identified security issues with: severity level (Critical/High/Medium/Low),
file location and line number, description of the risk, and recommended remediation.

Issues to document:
1. No rate limiting on Better Auth endpoints (High)
2. Login error message leaks auth detail — `result.error.message` (Medium)
3. `DATABASE_URL` hardcoded fallback credentials in `db/client.ts` (High)
4. Admin toggle `inputValidator` lacks bounds checking on `id` (Medium)
5. No request body size limits on `api/auth/$` handler (Low)

## User Experience

This task has no end-user-visible changes. All changes are developer-experience and
agent-experience improvements.

**Developer experience:** File navigation becomes predictable — server logic in
`.server.ts` files, types in `app/types/`, auth utility in `app/lib/session.ts`.
Opening any route file shows only the route and its UI. No hunting for where
`requireSession` is defined.

**Agent experience:** On session start, Claude reads `AGENTS.md` (auto-injected via
`CLAUDE.md` symlink) and understands the project structure, conventions, and which
skills to apply. Domain rule files are read when entering relevant task domains.
A new feature requires zero architecture re-discovery.

## Non-Goals

- Security vulnerability fixes (rate limiting code, error hardening, input validation
  code) — deferred to dedicated security task
- Env validation module (`app/lib/env.ts`) — security task scope
- Full `watcher.server.ts` restructure — complex fs/DB pipeline, deferred to V2
- Role-based permissions in auth schema — no multi-user requirement
- Automated SOLID linting (Biome custom rules) — V2 after rules are validated
- `$slug.tsx` server function extraction — borderline case, V2 decision
- Component layer refactor — no violations found; already clean

## Phased Rollout Plan

**Phase 1 (this task, atomic PR):**
- All 8 features in one branch `TASK-0004/code-org-security`
- CI must pass before merge (type check, lint, tests)
- Self-review against SOLID violation checklist before opening PR

**Phase 2 (future security task):**
- Address all 5 findings from SECURITY-FINDINGS.md
- Covers: rate limiting, env validation, error hardening, input validation, request size limits

**Phase 3 (future V2):**
- `$slug.tsx` server fn extraction
- `watcher.server.ts` restructure
- Automated SOLID linting

## Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| SOLID violations (critical) | 6 | 0 |
| `requireSession` copies in codebase | 2+ inline | 1 in `app/lib/session.ts` |
| `interface` in non-class/non-augmentation code | 3 | 0 |
| Shared type definitions in `app/types/` | 0 | 2+ (PostFrontmatter, AuthUser) |
| Agent context messages to orient in project | ~5 | ≤2 |
| Domain rule files | 0 | 4 (auth, routes, db, components) |
| Security findings documented | 0 | 5 (all identified) |
| Next-feature SOLID violations (3-PR rolling) | Unknown | 0 |

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Import path breakage after file moves | Medium | TypeScript `tsc --noEmit` in CI catches all broken imports before merge |
| MDX directory split breaks existing callers | Low | Only 2 callers (`$slug.tsx`, `preview.$slug.tsx`) — update both in same PR |
| AGENTS.md grows beyond 200 lines | Low | Rule: link to domain files rather than inline content; enforced by file size check |
| `routeTree.gen.ts` drift after route file changes | Low | TanStack Router auto-generates this file on dev server start — regenerate before commit |
| Server fn files not picked up by TanStack Start bundler | Low | TanStack Start supports any co-located `.server.ts` file — no extra config needed |

## Architecture Decision Records

- [ADR-001: Scope bounded to server fn extraction + shared auth util + docs](adrs/adr-001.md) — defines what is in and out of V1
- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md) — rules written after code ensures pattern alignment

## Open Questions

1. After the security task ships: should Better Auth rate limiting use a Redis adapter
   or the Drizzle-backed persistent store?
2. Should `watcher.server.ts` get a rule in `db.md` or `routes.md` prohibiting direct DB
   calls (callback pattern instead)?
3. Long-term: should `AGENTS.md` include a troubleshooting section for common agent
   mistakes in this codebase?
