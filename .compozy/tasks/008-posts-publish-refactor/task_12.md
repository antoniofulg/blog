---
status: completed
title: Hreflang emission in `buildLocaleHead` (only when twin exists)
type: frontend
complexity: low
dependencies:
    - task_02
    - task_03
feature: seo/hreflang
---

# Task 12: Hreflang emission in `buildLocaleHead` (only when twin exists)

## Overview
Update `buildLocaleHead` in `app/lib/locale.tsx` so the rendered page `<head>` emits `<link rel="alternate" hreflang="...">` tags only when the target-locale twin exists. Posts use `PostEntry.hasTwin`; pages use `staticPageHasTwin`; structural routes that exist natively in both locales emit reciprocal hreflang pairs unconditionally. This mirrors the sitemap's reciprocity invariant at the per-page `<head>` layer.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST emit `<link rel="alternate" hreflang="...">` tags only when the twin exists for the current route's content.
- MUST emit one tag per locale that has a twin (en and pt-br for content that has both; just self-reference for content that has only one).
- MUST emit `hreflang="x-default"` on the homepage `<head>` (and only the homepage).
- MUST NOT emit one-way hreflang (the rendered head must not reference a URL that itself does not reference back).
- MUST take the twin-availability source as input (do not call `staticPageHasTwin` synchronously inside a render path; pass the precomputed boolean down from the loader).
- MUST work for both post routes and the unified `$slug.tsx` page route (delivered by task_05).
</requirements>

## Subtasks
- [x] 12.1 Update `buildLocaleHead` signature to accept an optional twin-availability descriptor.
- [x] 12.2 Emit `hreflang` tags conditionally based on the descriptor.
- [x] 12.3 Wire the descriptor through the `$slug.tsx` loader return into the `<head>` builder.
- [x] 12.4 Verify the homepage emits `x-default` while non-homepage routes do not.
- [x] 12.5 Extend `app/tests/locale.test.ts` with hreflang emission cases.

## Implementation Details
See TechSpec "System Architecture → Component Overview" row for `app/lib/locale.tsx`. The reciprocity rule is documented in ADR-007 and validated externally by the market-research findings cited in the PRD.

### Relevant Files
- `app/lib/locale.tsx` — `buildLocaleHead` lives here (the codebase scan referenced it; confirm during implementation).
- `app/routes/{-$locale}/$slug.tsx` — consumer route delivering the loader-side twin boolean.
- `app/routes/{-$locale}/index.tsx` (or homepage equivalent) — emits `x-default`.

### Dependent Files
- Any other route that calls `buildLocaleHead` — TypeScript surfaces them when the signature changes.

### Related ADRs
- [ADR-007: Sitemap.xml generated per-request, no cache](adrs/adr-007.md) — defines the reciprocity rule mirrored here at the head layer.
- [ADR-005: Unified `$slug` loader resolves posts + static pages](adrs/adr-005.md) — supplies the descriptor needed by the head builder.

## Acceptance Criteria
1. AC-1: A post with both locale twins renders two `<link rel="alternate" hreflang>` tags (one for each locale).
2. AC-2: A post with only an en variant renders no `<link rel="alternate" hreflang>` tag pointing at pt-br; it also does not emit a self-referential en tag (because there is no twin to advertise).
3. AC-3: The homepage emits `<link rel="alternate" hreflang="x-default" href="…/" />` plus the two locale-specific entries.
4. AC-4: No route emits a `hreflang` tag pointing at a URL that would 404.

## Deliverables
- Updated `app/lib/locale.tsx`.
- Updated `$slug.tsx` and homepage routes to pass the twin descriptor.
- Extended `app/tests/locale.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for emitted `<head>` markup **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `buildLocaleHead` emits two `hreflang` tags for content with both locale twins.
  - [x] `buildLocaleHead` emits zero `hreflang` tags for content with only one locale variant.
  - [x] `buildLocaleHead` emits `x-default` only on the homepage descriptor.
  - [x] Emitted hrefs use the canonical origin (matches `SITE_URL` from task_11).
- Integration tests:
  - [x] `buildLocaleHead("en", { kind: "no-twin" })` → 0 hreflang links (covers no-pt-br-twin case).
  - [x] `buildLocaleHead("en", { kind: "has-twin" })` → 2 hreflang links (covers both-twins case).
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- No asymmetric `hreflang` in rendered output
- PRD Success Metric #5 (asymmetric hreflang violations = 0) holds at both sitemap and `<head>` layers
