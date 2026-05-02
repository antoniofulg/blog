---
status: pending
title: Admin Routes and Dashboard
type: frontend
complexity: high
dependencies:
  - task_05
  - task_08
  - task_09
  - task_10
---

# Task 11: Admin Routes and Dashboard

## Overview

Implement the auth-protected admin dashboard at `/admin` and the preview route at `/admin/preview/$slug`. The dashboard lists all indexed posts (draft and published) with their view counts and publish/unpublish toggle buttons. The preview route renders a post's MDX content using the same rendering pipeline as the public routes, accessible to logged-in users regardless of draft state. This is the final feature task — it integrates all other components and completes the end-to-end publish flow.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `getAllPosts()` server function returning all `Post[]` (draft + published), ordered by `indexed_at DESC`
- MUST implement `togglePublished(id: number, isPublished: boolean)` server function that sets `is_published` and, when publishing, sets `published_at = now()` if not already set
- MUST implement `getAdminPreview(slug: string)` server function returning `{ post: Post, source: string }` for any post regardless of publish state
- MUST protect both admin routes with a `beforeLoad` check on `context.auth.user`; redirect unauthenticated users to `/login` with the original URL as a `redirect` search parameter
- MUST implement the redirect-after-login flow: after successful login, redirect the user to the URL stored in the `redirect` search parameter
- MUST render the dashboard as an HTML table with columns: Title, Slug, Status (Draft/Published badge), Views, and Actions (Publish/Unpublish button, Preview link)
- MUST render the preview route using `renderMdx` from `app/lib/mdx.server.ts` with the same Tailwind prose styles as the public post detail page
- MUST implement a login page at `/login` with email and password fields, a submit button, and an inline error message on failure
- SHOULD show a toast or inline confirmation when a publish/unpublish action succeeds
</requirements>

## Subtasks

- [ ] 11.1 Implement `getAllPosts()` and `togglePublished()` server functions; wire `togglePublished` to a form action on the dashboard
- [ ] 11.2 Implement `getAdminPreview()` server function; build the preview route at `app/routes/admin/preview.$slug.tsx`
- [ ] 11.3 Build the admin dashboard table at `app/routes/admin/index.tsx` with auth guard, post list, status badges, view counts, and action buttons
- [ ] 11.4 Implement the login page at `app/routes/login.tsx` with email/password form and Better Auth client sign-in call
- [ ] 11.5 Implement redirect-after-login: read `redirect` search param after successful login and navigate to that URL
- [ ] 11.6 Verify the complete publish flow end-to-end: drop `.mdx` file → appears in admin as draft → click Publish → post is live at `/$slug`

## Implementation Details

See TechSpec "API Endpoints" for the `getAllPosts`, `togglePublished`, and `getAdminPreview` function signatures. See TechSpec "System Architecture" (Admin read data flow) for the auth-gated query path. See PRD "User Experience — Admin Dashboard Flow" for the UI requirements (table columns, no pagination, login redirect).

The auth guard pattern for admin routes follows the TechSpec "Integration Points" (Better Auth) section — use `context.auth.user` from the router context loaded in `__root.tsx` (task_10).

### Relevant Files

- `app/routes/admin/index.tsx` — new file; dashboard with auth guard
- `app/routes/admin/preview.$slug.tsx` — new file; preview route
- `app/routes/login.tsx` — new file; login page with redirect support
- `app/lib/auth.ts` (task_10) — `authClient` used in login form
- `app/lib/mdx.server.ts` (task_08) — `renderMdx` used in preview route
- `app/db/schema.ts` (task_03) — `Post` type for server functions
- `app/db/client.ts` (task_03) — `db` for server functions
- `app/db/indexer.ts` (task_05) — posts indexed by watcher; dashboard reads these

### Dependent Files

- No subsequent tasks depend on this; this is the final feature task

### Related ADRs

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — admin CRUD included in V1; full publish flow required
- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — `is_published` controlled exclusively by admin UI; `published_at` set on first publish
- [ADR-003: MDX Compilation — @mdx-js/mdx Direct](adrs/adr-003.md) — preview route uses same `renderMdx` as public routes

## Deliverables

- `app/routes/admin/index.tsx` — dashboard with auth guard and publish controls
- `app/routes/admin/preview.$slug.tsx` — preview route
- `app/routes/login.tsx` — login page with redirect-after-login
- Server functions: `getAllPosts`, `togglePublished`, `getAdminPreview`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the complete publish flow **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `getAllPosts()` returns both draft and published posts (no `is_published` filter)
  - [ ] `togglePublished(id, true)` sets `is_published = true` and `published_at = now()` when `published_at` is null
  - [ ] `togglePublished(id, true)` does not overwrite an existing non-null `published_at`
  - [ ] `togglePublished(id, false)` sets `is_published = false` and does not change `published_at`
  - [ ] `getAdminPreview('draft-slug')` returns the post regardless of `is_published` value
  - [ ] Admin `beforeLoad` with `context.auth.user = null` redirects to `/login?redirect=/admin`
- Integration tests:
  - [ ] `GET /admin` without a session cookie redirects to `/login?redirect=%2Fadmin`
  - [ ] `GET /admin` with a valid session cookie returns 200 and the dashboard HTML
  - [ ] Dashboard HTML contains a table row for each indexed post (seed 2 posts; assert 2 rows)
  - [ ] `POST` to toggle publish for post ID N sets `is_published = true`; `GET /` then lists the post
  - [ ] `GET /admin/preview/draft-slug` with a valid session returns 200 and rendered MDX content
  - [ ] `GET /admin/preview/draft-slug` without a session redirects to `/login`
  - [ ] Full publish flow: index `.mdx` file → `GET /admin` shows it as Draft → toggle Publish → `GET /$slug` returns 200
  - [ ] Login page at `GET /login?redirect=/admin`: after successful login, redirect lands on `/admin`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Unauthenticated requests to `/admin` redirect to `/login` with the original URL preserved
- Complete publish flow works end-to-end on a clean clone: file → admin → publish → public page live
- `docker compose up && bun dev` → `bun run db:migrate` → `bun run db:seed` → login → publish → public page: all steps succeed in under 5 minutes
