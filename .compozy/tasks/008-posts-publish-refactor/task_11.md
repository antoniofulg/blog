---
status: completed
title: "`/sitemap.xml` route + `getSitemapEntriesFn` + reciprocity unit test"
type: backend
complexity: medium
dependencies:
    - task_02
    - task_03
feature: seo/sitemap
---

# Task 11: `/sitemap.xml` route + `getSitemapEntriesFn` + reciprocity unit test

## Overview
Add a new `app/routes/sitemap[.]xml.ts` route that emits a per-request XML sitemap listing every post and static page, with `<xhtml:link rel="alternate" hreflang>` annotations only when both locale variants exist per ADR-007. The reciprocity unit test enforces PRD Success Metric #5 (zero asymmetric hreflang violations) by asserting that for every annotation emitted, the referenced URL is also in the urlset with a reciprocal annotation.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/routes/sitemap[.]xml.ts` and (optionally) `app/routes/sitemap[.]xml.server.ts` co-located, mirroring the `app/routes/robots[.]txt.ts:6-10` content-type idiom.
- MUST expose `getSitemapEntriesFn` returning `Array<{ loc: string; alternates: Array<{ hreflang: string; href: string }>; isDefault?: boolean }>`.
- MUST read posts via Drizzle (no `isPublished` filter — task_02) and pages via `enumerateStaticPages` (task_03) for both locales.
- MUST emit reciprocal `hreflang` annotations only when both locale files exist; emit `x-default` on the EN homepage entry only.
- MUST set `Content-Type: application/xml` on the response.
- MUST derive the canonical URL origin from a `SITE_URL` env var with a sensible localhost fallback for dev.
- MUST NOT introduce an XML library — hand-written string template with a small attribute-escape helper is sufficient.
- MUST NOT cache the response in module scope (no in-memory cache per ADR-007).
</requirements>

## Subtasks
- [x] 11.1 Create `app/routes/sitemap[.]xml.ts` exposing a GET handler that returns `new Response(xml, { headers: { "content-type": "application/xml" } })`.
- [x] 11.2 Implement `getSitemapEntriesFn` reading posts + pages and computing alternates.
- [x] 11.3 Implement a small XML renderer (string template + attribute-escape helper).
- [x] 11.4 Add `SITE_URL` env handling with localhost fallback; document the env var in `.env.example` if one exists, or `CONTENT.md`.
- [x] 11.5 Write the reciprocity unit test in `app/tests/sitemap.test.ts`.

## Implementation Details
See TechSpec "Core Interfaces" → `getSitemapEntriesFn` and "API Endpoints" → `/sitemap.xml`. The robots.txt pattern is at `app/routes/robots[.]txt.ts:6-10`.

### Relevant Files
- `app/routes/robots[.]txt.ts:6-10` — content-type response idiom to mirror.
- `app/db/queries.ts` — `getAllPostsFn` (renamed in task_02) source.
- `app/lib/mdx/pages.server.ts` — `enumerateStaticPages` source (task_03).
- `app/lib/locale.tsx` — `Locale` type + `LOCALES` constant for iterating both locales.

### Dependent Files
- `package.json` / `.env.example` — `SITE_URL` env doc.
- App-audit skill may add a `sitemap` finding category in V2 — not in scope for this task.

### Related ADRs
- [ADR-007: Sitemap.xml generated per-request, no cache](adrs/adr-007.md) — directly implements this ADR.
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — supplies the page enumeration source.

## Acceptance Criteria
1. AC-1: GET `/sitemap.xml` returns 200 with `Content-Type: application/xml` and a body matching the `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">…</urlset>` shape.
2. AC-2: For a fixture set with one post that has both locales and one post that has en only, the en post emits a reciprocal `hreflang="pt-br"` annotation; the en-only post emits no `hreflang` annotation.
3. AC-3: The EN homepage entry includes a `hreflang="x-default"` annotation; no other entry does.
4. AC-4: Reciprocity invariant holds: for every `<xhtml:link rel="alternate" hreflang>` annotation in the rendered urlset, the referenced URL is present in the urlset with a reciprocal annotation pointing back.

## Deliverables
- New `app/routes/sitemap[.]xml.ts` (+ optional `.server.ts`).
- New `app/tests/sitemap.test.ts`.
- Doc update (`.env.example` or `CONTENT.md`) covering `SITE_URL`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for HTTP response shape **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `getSitemapEntriesFn` returns entries for every seeded post + page.
  - [x] Entries for content with both locales include reciprocal `hreflang` pairs.
  - [x] Entries for content with only one locale include no `hreflang` annotation.
  - [x] EN homepage entry includes `x-default`; pt-br homepage entry does not.
  - [x] Reciprocity invariant assertion across the rendered urlset.
- Integration tests:
  - [x] HTTP GET `/sitemap.xml` returns 200 + `Content-Type: application/xml` + a body that parses as XML and contains the seeded posts and pages.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Reciprocity invariant holds in the rendered XML
- PRD Success Metric #5 (asymmetric hreflang violations = 0) achievable from the sitemap unit test alone
