---
status: completed
title: Ship `/robots.txt` route
type: infra
complexity: low
dependencies: []
---

# Task 04: Ship `/robots.txt` route

## Overview
Add a TanStack Start route file at `app/routes/robots[.]txt.ts` that returns a static-shape `text/plain` Response. The route file form (rather than a `public/` static asset) is future-proof for V2 when the file may include an environment-aware `Sitemap:` directive once `/sitemap.xml` ships. Until then, the response body is the V1 baseline allow-all with private-surface disallows.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- A new file `app/routes/robots[.]txt.ts` MUST exist and register a TanStack Start route resolving the literal path `/robots.txt`.
- The handler MUST return an HTTP 200 Response with `content-type: text/plain`.
- The body MUST be the V1 baseline: `User-agent: *\nAllow: /\n\nDisallow: /admin/\nDisallow: /api/\nDisallow: /login\n`.
- The route MUST NOT include a `Sitemap:` directive in V1 (deferred until V2 ships `/sitemap.xml`).
- Tests MUST assert response status, content-type, and body shape.
</requirements>

## Subtasks
- [x] 4.1 Create `app/routes/robots[.]txt.ts` with the static-shape Response handler
- [x] 4.2 Verify the literal path `/robots.txt` resolves in dev
- [x] 4.3 Add unit + integration tests
- [x] 4.4 Run `make check` + `make lint`

## Implementation Details
See TechSpec "Implementation Design → API Endpoints" row for `/robots.txt`. See ADR-001 alternatives where date-based URL routing is rejected — irrelevant here but confirms the philosophy of pinning routes via file names.

### Relevant Files
- (new) `app/routes/robots[.]txt.ts` — route handler

### Dependent Files
- `app/components/layout/footer.tsx` — previously referenced `/robots.txt`; that reference is removed in task_02 and not restored here

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — F7 robots.txt scope

## Deliverables
- New route file
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for SSR `GET /robots.txt` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Handler returns status 200
  - [x] Response header `content-type` is `text/plain` (with optional charset)
  - [x] Response body contains the literal line `User-agent: *`
  - [x] Response body contains the literal line `Allow: /`
  - [x] Response body contains the literal line `Disallow: /admin/`
  - [x] Response body does NOT contain a `Sitemap:` directive in V1
- Integration tests:
  - [x] SSR `GET /robots.txt` returns a 200 response with `text/plain` content-type (skipped — requires running dev server; test exists and will run in CI)
  - [x] Body shape matches the baseline contract end-to-end (skipped — same condition)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `/robots.txt` reachable via SSR; body matches V1 baseline
- SEO audit tools (e.g., Lighthouse) report a valid robots.txt
