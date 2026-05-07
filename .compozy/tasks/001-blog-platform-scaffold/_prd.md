# PRD: Blog Platform Scaffold

## Overview

A personal blog platform scaffold for content-focused projects. The developer clones the repository, runs two commands (`docker compose up && bun dev`), and is writing feature code within 60 seconds. Post content lives as `.mdx` files in a `/content` directory — the author's native code editor is the writing surface. A file watcher automatically indexes new and changed posts into Postgres as drafts. An auth-protected admin dashboard provides publish control, rendered MDX preview, and a simple per-post view counter.

The scaffold combines Bun, React 19, TanStack Start, Drizzle ORM, Better Auth, Tailwind CSS with the typography plugin, and BiomeJS into a single, opinionated, clone-and-run repository. It targets personal use: one author, one admin user, no external documentation required.

## Goals

- A developer with Docker and Bun installed goes from `git clone` to a running dev server in under 60 seconds, with zero files requiring manual configuration.
- Every new `.mdx` file dropped into `/content` appears in the admin dashboard automatically — no sync command required.
- The admin publish flow (write file → see in admin → publish → live on public site) works end-to-end in a clean clone.
- Public blog pages render MDX content with syntax-highlighted code blocks and readable prose typography out of the box.
- The scaffold serves as a validated reference integration of the chosen tech stack, eliminating repeated boilerplate setup on future content projects.

## User Stories

### Developer / Author (primary persona)

- As the developer, I want `docker compose up && bun dev` to boot the full local stack so I can start writing feature code immediately after cloning.
- As the author, I want to write posts as `.mdx` files in my code editor so I can use my preferred tooling, Git history, and syntax highlighting.
- As the author, I want new `.mdx` files to appear automatically in the admin dashboard so I don't have to run a sync command after every file change.
- As the author, I want to toggle a post between draft and published from the admin UI so I can control visibility without editing files.
- As the author, I want to preview the rendered MDX output from the admin before publishing so I can catch formatting errors.
- As the author, I want to see total view counts per post in the admin dashboard so I know which content resonates.
- As the author, I want to visit the admin, log in, and be redirected back to where I was going so the auth flow doesn't interrupt my workflow.

### Future-self (secondary persona)

- As the developer cloning this scaffold six months later, I want the two-command startup to still work without reading a setup guide.
- As the developer starting a new content project, I want to clone this scaffold and have all tooling (linter, formatter, database, auth) pre-wired so I spend zero time on configuration.

## Core Features

### F1: Zero-Config Local Dev Stack — Critical

Running `docker compose up && bun dev` on a clean clone starts the full local environment: Postgres container, Drizzle schema migrations, Better Auth session table creation, an admin user seed, and the TanStack Start dev server. No `.env` file editing, no database setup, no manual migration step. Environment variables ship with working local defaults. The 60-second target is the acceptance criterion.

### F2: File-Based Content with Auto-Sync Indexer — Critical

Post content lives as `.mdx` files in a `/content` directory. On `bun dev` start, a file watcher discovers all `.mdx` files and indexes their frontmatter metadata (title, slug, publication date) into a Postgres posts table. New files and modifications are picked up automatically while the dev server runs. Each post is indexed as unpublished on first discovery. The file's content is always read from disk at render time — the database holds the index, not the content. A manual `bun run sync` command is available as a fallback for CI or environments where the file watcher is restricted.

### F3: Public Blog Routing — Critical

Two public routes serve the blog:

- **Post list** (`/`): displays all published posts ordered by publication date, showing title, date, and a short excerpt derived from the MDX frontmatter `description` field.
- **Post detail** (`/$slug`): renders the full post content from the `.mdx` file. Each visit increments the post's view counter in Postgres. Page title, meta description, and Open Graph tags are populated from frontmatter fields (`title`, `description`).

Both routes are server-rendered. Unpublished (draft) posts are not accessible from public routes.

### F4: BiomeJS Linting and Formatting — High

A single `biome.json` replaces ESLint and Prettier. `biome check .` passes with exit code 0 on a clean clone. The VS Code workspace settings file configures BiomeJS as the default formatter so the developer gets auto-format on save immediately. Pre-commit hook (via Lefthook) runs `biome check --apply` to enforce formatting before every commit.

### F5: Better Auth Admin Protection — High

An auth handler route at `app/routes/api/auth/$.ts` handles login and session management. The root route's `beforeLoad` function loads session state into router context. Admin routes check `context.auth.user` in their `beforeLoad` and redirect unauthenticated users to the login page. After login, the user is redirected to the originally requested URL. Session tokens are stored in HttpOnly cookies — never exposed to client-side JavaScript. A single admin user is seeded automatically during Docker Compose startup.

### F6: Admin Publish Control Dashboard — High

An auth-protected admin dashboard at `/admin` lists all indexed posts with:
- Post title and slug
- Status indicator: **Draft** or **Published**
- View count (total all-time page views)
- **Publish** / **Unpublish** toggle button
- **Preview** link that renders the post in a protected preview route at `/admin/preview/$slug`

Toggling publish state updates the database record immediately and reflects on the public site on the next request. The dashboard does not provide a content editor — writing happens in the code editor. No pagination in V1.

### F7: Simple View Counter — High

Each visit to a public post detail page (`/$slug`) increments an integer counter stored in the posts index table. The counter is read in the admin dashboard alongside each post. No external analytics service, no JavaScript tracking snippet, no cookie consent required. Bot filtering is not included in V1.

### F8: Server-Side MDX Rendering with Syntax Highlighting — High

Post content is compiled server-side per request from the `.mdx` file on disk. The MDX compiler never ships to the client bundle. Code blocks are syntax-highlighted using a server-side highlighter. Tailwind CSS with `@tailwindcss/typography` provides prose defaults: readable line height, heading hierarchy, code block contrast, and link styling. The developer overrides these styles per project.

## User Experience

### Developer Onboarding Flow

1. `git clone <repo>` — single command, no tokens or credentials
2. `docker compose up` — Postgres starts, migrations run, admin user is seeded
3. `bun dev` — dev server starts; terminal shows the local URL
4. Open the browser — public post list is visible (empty until content is added)
5. Drop `content/hello-world.mdx` into the repo — the file watcher picks it up; it appears in the admin as a draft within two seconds
6. Visit `/admin` — log in with the seeded credentials; redirect back to dashboard
7. Click **Publish** on `hello-world` — the post is immediately live at `/hello-world`

Total elapsed time from step 1 to a live post: under five minutes on a pre-warmed machine.

### Admin Dashboard Flow

The admin is a minimal, functional interface — no design system beyond Tailwind defaults. Priority is clarity and speed, not polish:

- Login page: email and password fields, submit button, error message on failure
- Dashboard: full-width table of all indexed posts. Columns: Title, Status, Views, Actions (Publish/Unpublish, Preview)
- Preview route: renders the post at `/admin/preview/$slug` — same MDX rendering pipeline as the public route, accessible to logged-in users only

### Public Reader Flow

- Post list page: clean list of published posts, newest first. Each item shows title, date, and excerpt. No sidebar, no tag filters, no search.
- Post detail page: full-width prose layout. Post title as `<h1>`, publication date below, MDX content rendered with Tailwind typography. Code blocks syntax-highlighted. No comments section.

### Accessibility

Public pages use semantic HTML: `<article>`, `<main>`, `<nav>` landmarks. Heading hierarchy is enforced by MDX conventions. Color contrast meets WCAG AA for the default Tailwind typography palette. Admin pages follow the same conventions.

## High-Level Technical Constraints

- The scaffold must run entirely on the developer's local machine using only Docker and Bun as prerequisites.
- Post content must be readable and renderable directly from the file system without a running Postgres instance — the database is an index, not the source of truth.
- Session tokens must never be accessible to client-side JavaScript (HttpOnly cookies enforced by Better Auth).
- The MDX compiler must not be included in the client JavaScript bundle.
- Public pages must be server-rendered — no client-side data fetching for post content or metadata.
- All linting and formatting must be handled by a single tool (BiomeJS) with zero manual configuration after cloning.

## Non-Goals

- **Browser-based MDX editor** — posts are written in the developer's code editor; no textarea or rich-text editor in the admin
- **Multi-user auth** — single admin account; role-based access control is out of scope
- **Social / OAuth login** — email + password session auth only in V1
- **Email flows (magic links, password reset)** — auth is for a single known user; recovery is handled via the seed script
- **RSS feed** — add per project when needed; not scaffold-level concern
- **Tag or category system** — no taxonomy in V1; the post list is unfiltered
- **Search** — no full-text or fuzzy search on the public site
- **Media / image uploads** — images are referenced as static assets or external URLs in MDX
- **Comments system** — third-party service decision, not scaffold-level
- **Production Dockerfile or CI/CD pipelines** — Docker Compose is for local dev only; deploy targets vary per project
- **Analytics beyond view counts** — no time-series charts, referrer tracking, or geographic data in V1
- **Bot filtering on view counter** — counts are approximate; filtering is V2

## Phased Rollout Plan

### Phase 1 — Core Scaffold (MVP)

Core features that must work on a clean clone before anything else is added:

- F1: Zero-config local dev stack — `docker compose up && bun dev` succeeds in < 60 seconds
- F2: File-based content with auto-sync indexer — new `.mdx` files appear in Postgres within 2 seconds
- F3: Public blog routing — post list and detail pages render published posts with SEO metadata
- F4: BiomeJS — `biome check .` passes on a clean clone

**Success criterion to proceed to Phase 2:** A developer on a clean machine completes the onboarding flow (clone → docker → dev → drop file → see in DB) without consulting any documentation.

### Phase 2 — Auth and Admin

- F5: Better Auth admin protection — login, session, redirect-after-login
- F6: Admin publish control dashboard — list, toggle, preview

**Success criterion to proceed to Phase 3:** The full publish flow (drop file → admin login → publish → post live on public site) works end-to-end on a clean clone.

### Phase 3 — Polish and Co-Artifact

- F7: Simple view counter — per-post views shown in admin
- F8: Server-side MDX rendering with Tailwind typography and syntax highlighting
- Compozy task files (PRD, TechSpec, task files) published as co-artifact alongside the scaffold

**Success criterion:** One real content project is started from this scaffold, ships a post, and the scaffold requires no modifications to support the workflow.

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Time from `git clone` to `bun dev` running | < 60 seconds | Manual stopwatch on a clean machine with Docker and Bun pre-installed |
| Files requiring manual edit before first feature | 0 | Count of files with `# TODO: configure` on a clean clone |
| Commands required after clone | ≤ 2 | Count entries in the quick-start section of the repo root |
| `biome check .` exit code on clean clone | 0 | Run immediately after clone, before any edits |
| `docker compose up` success on first attempt | 100% | Verified in Phase 1 acceptance test |
| File-to-admin latency (new `.mdx` → visible in admin) | < 2 seconds | Measured during Phase 2 acceptance test |
| Publish-to-live latency (click Publish → public page visible) | < 1 second | Verified during Phase 2 acceptance test |

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| TanStack Start v1 breaking changes before scaffold is complete | Medium | Pin all dependency versions in the lockfile; test against pinned versions in CI |
| File watcher unreliable on some developer machines | Medium | Ship `bun run sync` as a documented fallback; mention it in the onboarding flow |
| Scope creep from open questions during implementation | High | Refer to this PRD's Non-Goals list; create a new PRD before adding any out-of-scope feature |
| The scaffold becomes unmaintainable as upstream tools release breaking changes | Medium | Version-pin all four immature dependencies; include a smoke test covering the auth-to-database round trip |
| The 60-second DX promise fails due to slow Docker image pulls on first run | Low | Document the prerequisite (Docker and Bun already installed); the timer starts after images are available |

## Architecture Decision Records

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — Full starter kit confirmed over simpler alternatives; mandatory guard rails (pinned lockfile, smoke tests, MDX boundary) baked in
- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — Hybrid file-based content with auto-sync indexer; admin owns publish state, file system owns content

## Open Questions

- Which server-side MDX compilation library fits best inside TanStack Start's server function model: `@mdx-js/mdx` (direct), `mdx-bundler`, or a custom remark/rehype pipeline?
- Should the admin user seed use a fixed default credential (documented in the repo) or generate a random password printed once to the Docker Compose log on first boot?
- What syntax highlighting library should be used for server-side code block highlighting: `shiki` (theme-based, heavier) or `highlight.js` (lightweight, fewer themes)?
- Should per-post SEO frontmatter fields (`description`, `og:image`) be required or optional with scaffold-level fallback defaults?
- What is the stable identifier for a post in Postgres — the file path or the frontmatter `slug` field? (ADR-002 recommends file path; TechSpec to confirm.)
