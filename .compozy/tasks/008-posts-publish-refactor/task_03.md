---
status: completed
title: Add `pages.server.ts` module (load / hasTwin / enumerate)
type: backend
complexity: medium
dependencies: []
feature: pages/static-pages
---

# Task 03: Add `pages.server.ts` module (load / hasTwin / enumerate)

## Overview
Introduce `app/lib/mdx/pages.server.ts` as the sole entry point for static-page access per ADR-001. The module encapsulates filesystem reads, MDX rendering, and twin-availability checks so that downstream consumers (the unified `$slug` route, the sitemap, the language switcher, the content-audit pipeline) all query the same surface and the existing `existsSync` calls never sprawl across the codebase.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST expose three named functions: `loadStaticPage(slug, locale)`, `staticPageHasTwin(slug, targetLocale)`, `enumerateStaticPages(locale)` per the TechSpec "Core Interfaces" section.
- MUST resolve the page MDX from `app/content/pages/<locale>/<slug>.mdx` and reject paths that escape that directory (no `..` traversal).
- MUST parse frontmatter with at least the `title` field (required) and `description` (optional); reject pages missing the required field.
- MUST render MDX through the existing `renderMdx` pipeline in `app/lib/mdx/renderer.server.ts` — no duplicate render plumbing.
- MUST NOT create or query any DB row; the module is filesystem-only per ADR-001.
- MUST NOT read or expose post-only frontmatter fields (`date`, `series`, `category`, `noTranslation`).
</requirements>

## Subtasks
- [x] 03.1 Define the `PageEntry` and `PageFrontmatter` types alongside the module exports.
- [x] 03.2 Implement `loadStaticPage(slug, locale)` — read the file, parse frontmatter, render MDX, return `{ entry, html } | null`.
- [x] 03.3 Implement `staticPageHasTwin(slug, targetLocale)` — `existsSync` for the twin's path; no read.
- [x] 03.4 Implement `enumerateStaticPages(locale)` — directory walk returning the list of `PageEntry` (frontmatter parsed, no html rendered).
- [x] 03.5 Add a path-traversal guard that rejects slugs containing `..`, `/`, `\`, or null bytes before any filesystem call.

## Implementation Details
See TechSpec "Implementation Design → Core Interfaces" for the type definitions and signatures. The MDX render chain is documented in the idea phase research at `app/lib/mdx/renderer.server.ts:34-48`. The legacy `about.server.ts` loader is the pattern this module generalizes.

### Relevant Files
- `app/lib/mdx/renderer.server.ts:34-48` — `renderMdx` pipeline to reuse.
- `app/lib/mdx/parser.server.ts` — frontmatter parser to reuse.
- `app/lib/mdx/about.server.ts:30-63` — current per-page loader (deleted in task_04 once this module replaces it).
- `app/lib/locale.tsx:9` — `Locale` type to import.
- `app/lib/site-model.server.ts:268-279` — `PostEntry.hasTwin` precedent for the boolean shape.

### Dependent Files
- Task_04 deletes `about.server.ts` and calls `loadStaticPage("about", locale)` instead.
- Task_05 calls `loadStaticPage` as the second branch of the unified slug loader.
- Task_06 calls `enumerateStaticPages` for translation-gap parity and the slug-collision finding.
- Task_09 calls `staticPageHasTwin` from the twin-availability helper.
- Task_11 calls `enumerateStaticPages` from the sitemap generator.

### Related ADRs
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — directly implements this ADR.
- [ADR-005: Unified `$slug` loader resolves posts + static pages](adrs/adr-005.md) — task_05 depends on this module.

## Acceptance Criteria
1. AC-1: `app/lib/mdx/pages.server.ts` exists and exports `loadStaticPage`, `staticPageHasTwin`, `enumerateStaticPages`, `PageEntry`, `PageFrontmatter`.
2. AC-2: `loadStaticPage("about", "en")` returns `{ entry, html }` for the migrated `app/content/pages/en/about.mdx` (handed off by task_04); `loadStaticPage("nope", "en")` returns `null`.
3. AC-3: `staticPageHasTwin("about", "pt-br")` returns `true` after the migration; `staticPageHasTwin("only-en", "pt-br")` returns `false` for a fixture page without a pt-br twin.
4. AC-4: `loadStaticPage("../etc/passwd", "en")` rejects the request (returns `null` or throws a typed error) — path-traversal guard.

## Deliverables
- New `app/lib/mdx/pages.server.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the load + twin-check + enumeration round-trip **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `loadStaticPage` happy path: returns parsed frontmatter + rendered html for a fixture page (use `vi.mock("node:fs/promises")` per existing `about.test.ts` pattern).
  - [x] `loadStaticPage` missing-file path: returns `null` (not throws) for a non-existent slug.
  - [x] `loadStaticPage` missing-title path: rejects a fixture page whose frontmatter has no `title`.
  - [x] `loadStaticPage` path-traversal rejection: `../etc/passwd`, `/etc/passwd`, slugs containing `\0`.
  - [x] `staticPageHasTwin`: returns `true` when both locales' files exist; `false` otherwise.
  - [x] `enumerateStaticPages`: returns one `PageEntry` per `.mdx` file in `app/content/pages/<locale>/`; skips non-mdx files.
- Integration tests:
  - [x] Round-trip on a real fixture file laid down in a tmpdir: write a `pages/en/test.mdx`, call `loadStaticPage("test", "en")`, assert rendered html contains expected content.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Module shape matches TechSpec "Core Interfaces" section exactly
- Path-traversal guard verified in unit tests
