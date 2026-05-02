# Blog Platform Scaffold

## Overview

A personal blog platform scaffold that eliminates setup friction for content projects. Combines Bun, React 19, TanStack Start, Postgres (Docker Compose), Drizzle ORM, Better Auth, and BiomeJS into a single clone-and-run repository. The DX goal: `docker compose up && bun dev` with feature code being written within 60 seconds of cloning.

The scaffold ships as two artifacts: (1) a working full starter kit with public blog pages, MDX rendering, auth-protected admin routes, and basic post CRUD; and (2) Compozy task files (PRD, TechSpec, task files) as a co-artifact that make the scaffold re-generatable and customizable via the workflow pipeline.

This is a personal developer tool — highly opinionated, no external documentation, no community surface area in V1.

## Problem

Every new content-focused project begins with 2–4 hours of boilerplate wiring: configuring a formatter and linter, connecting a database, initializing routing, wiring auth, deciding on MDX processing. These decisions are not creative work — they are repeated, mechanical setup that produces nothing the first user sees.

The existing tools handle this individually. `bunx create-tanstack-start@latest` scaffolds a bare TanStack Start project. Drizzle Kit generates schema files. Better Auth ships an integration guide. But no single scaffold wires all six tools together into a running, authenticated, content-capable system. The closest community starter (`daveyplate/better-auth-tanstack-starter`) covers TanStack Start + Better Auth + Drizzle but omits Bun as the runtime and Docker Compose for local database management — meaning the developer still hits the same Bun-specific integration problems (postgres.js driver selection, vite-env-only externalization, tanstackStartCookies plugin ordering) on every new project.

The result is a recurring tax: the developer who wants to start a new blog or content project either starts from scratch and loses a weekend, or reaches for a Next.js starter and trades away the stack they actually want.

### Market Data

- No published scaffold bundles all six tools (Bun + TanStack Start + Drizzle + Better Auth + Biome + Docker Compose) as of May 2026.
- TanStack Start reached v1 in late 2025; community starters remain sparse. The gap closes within 6–12 months as the ecosystem matures — this is a first-mover window.
- The dominant fullstack TypeScript blog pattern remains Next.js App Router + Prisma + Tailwind. A TanStack Start + Drizzle scaffold occupies a differentiated position for developers who want no vendor lock-in and explicit data access patterns.

## Core Features

| #  | Feature                          | Priority | Description                                                                                                                                                 |
|----|----------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| F1 | Zero-config local dev            | Critical | `docker compose up && bun dev` boots the full stack — Postgres, Drizzle migrations, Better Auth session table, and dev server — with no manual config steps. |
| F2 | Public blog routing              | Critical | TanStack Start file-based routes for `/` (post list) and `/$slug` (post detail), driven by Drizzle queries inside server loaders.                           |
| F3 | Drizzle ORM schema + migrations  | Critical | Schema-first `posts` table (title, slug, content, publishedAt, draft) with Drizzle Kit migrations that run automatically on first `docker compose up`.      |
| F4 | BiomeJS linting + formatting     | High     | Single `biome.json` replacing ESLint + Prettier. `biome check` passes on a clean clone. VS Code extension configured as default formatter.                  |
| F5 | Better Auth admin protection     | High     | Auth handler at `app/routes/api/auth/$.ts`. Admin routes protected via TanStack Router `beforeLoad` + `getSession()`. `tanstackStartCookies` plugin last.   |
| F6 | Admin CRUD interface             | High     | Auth-protected admin pages for creating, editing, and deleting posts. Forms submit via TanStack Start server functions backed by Drizzle mutations.          |
| F7 | Server-side MDX rendering        | Medium   | Post content stored as MDX; compiled server-side per request. MDX compiler never ships to the client bundle — enforced via `vite-env-only`.                 |
| F8 | Compozy task files co-artifact   | Medium   | PRD, TechSpec, and task files published alongside the scaffold so the project is re-generatable and customizable via the Compozy workflow pipeline.          |

## KPIs

| KPI                                              | Target     | How to Measure                                                       |
|--------------------------------------------------|------------|----------------------------------------------------------------------|
| Time from `git clone` to `bun dev` running       | < 60s      | Manual stopwatch on a clean machine with Docker and Bun pre-installed |
| Files requiring manual edit before first feature | = 0        | Count files with `# TODO: configure` markers on a clean clone        |
| Setup steps after clone                          | ≤ 2        | Count commands in the getting-started section of the repo root       |
| `biome check` exit code on clean clone           | 0 (pass)   | Run `biome check .` immediately after clone, before any edits        |
| `docker compose up` success on first attempt     | 100%       | Smoke test via GitHub Actions on each commit to main                 |

## Feature Assessment

| Criteria            | Question                                            | Score    |
|---------------------|-----------------------------------------------------|----------|
| **Impact**          | How much more valuable does this make the product?  | Must do  |
| **Reach**           | What % of users would this affect?                  | Must do  |
| **Frequency**       | How often would users encounter this value?         | Strong   |
| **Differentiation** | Does this set us apart or just match competitors?   | Strong   |
| **Defensibility**   | Is this easy to copy or does it compound over time? | Maybe    |
| **Feasibility**     | Can we actually build this?                         | Must do  |

Leverage type: Quick Win — small effort, disproportionate value per project started.

## Council Insights

- **Recommended approach:** Full starter kit with mandatory guard rails baked in — pinned lockfile, explicit version constraints for all four immature dependencies (TanStack Start v1, React 19, Better Auth, Drizzle), auth-to-database smoke test, and a known-good Docker Compose baseline.
- **Key trade-offs:** Architectural coherence (clear data plane, explicit server/client split) vs. operational risk (limited community debugging surface for TanStack Start + Better Auth + React 19 interactions). Risk is bounded and front-loaded for a low-traffic, single-operator system.
- **Risks identified:**
  - MDX compilation leaking to client bundle → use `vite-env-only`, server-side only
  - Better Auth cookie handling breaking → `tanstackStartCookies` must be last plugin
  - Drizzle/postgres.js imports leaking to client → explicit module externalization
  - Opaque failures from stacked immaturity → pinned lockfile + smoke test suite covering auth-to-database round trip
- **Stretch goal (V2+):** Extract a CLI scaffolding tool (`create-tanstack-blog`) after the scaffold is validated on at least one real shipped project. The Compozy task files co-artifact is the intermediate step — publish the specification alongside the output so V2 has a foundation to build from.

## Summary / Differentiator

No published scaffold currently integrates Bun-as-runtime with TanStack Start v1, Drizzle, Better Auth, Biome, and Docker Compose. This scaffold closes that gap for the TanStack Start early-adopter community while being first-mover in a sparse ecosystem. The Compozy task files co-artifact is a novel distribution model: the scaffold is re-generatable and customizable without a CLI.

## Out of Scope (V1)

- **Production Dockerfile** — adds CI/CD complexity before the integration is validated; Docker Compose is sufficient for local dev
- **CI/CD pipelines** — premature before the scaffold is used on a real project; every deploy target is different
- **Multi-user auth** — Better Auth supports it, but admin is single-user for a personal blog; multi-user is V2
- **Social / OAuth providers** — Better Auth supports them; excluded to keep the auth surface minimal and the integration testable
- **Email (magic links, password reset)** — same rationale; add after the basic session flow is validated
- **Media / image uploads** — requires an S3-compatible store or CDN decision; belongs in project-specific customization
- **SEO plugin system** — TanStack Start supports head meta; a plugin system is premature abstraction for V1
- **RSS feed** — low-value infrastructure for a scaffold that may never publish a post; add when a project needs it
- **Comments system** — third-party service decision; not scaffold-level concern
- **CLI scaffolding tool** — V2, after the scaffold is validated on at least one shipped project

## Architecture Decision Records

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — Full starter kit confirmed over simpler alternatives; guard rails (pinned lockfile, smoke tests, MDX boundary) are mandatory

## Open Questions

- Which MDX processing library is the right fit for server-side-only compilation inside TanStack Start? (`@mdx-js/mdx` direct, `mdx-bundler`, or `next-mdx-remote` adapted?)
- Should the Docker Compose startup sequence auto-seed an admin user, or should a one-time `bun run db:seed` command be required after first boot?
- What is the minimal Drizzle schema for posts in V1? (Proposed: `id`, `title`, `slug`, `content`, `publishedAt`, `draft`, `createdAt`, `updatedAt`)
- Should the scaffold include a base Tailwind CSS setup, or keep styling unopinionated and let each project add its own?
