---
status: completed
title: Migrate About to MDX-per-locale + tests
type: frontend
complexity: high
dependencies:
    - task_07
    - task_10
---

# Task 13: Migrate About to MDX-per-locale + tests

## Overview
Replace the hardcoded `app/routes/about.tsx` with MDX-per-locale content sourced from `content/<locale>/about.mdx`. New helper `app/lib/mdx/about.server.ts` exports a Zod schema (`aboutFrontmatterSchema`), the result types (`AboutFrontmatter`, `AboutContent`), and `loadAbout(locale)` which reads, validates, and renders the file. New route at `app/routes/{-$locale}/about.tsx` + `about.server.ts` wires the loader. Indie-dev minimal content structure per PRD: identity 1-liner, photo, bio body, Now section, contact links. Hreflang pairs on About. Existing tests against `/about` rewritten for locale-aware routing.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `content/en/about.mdx` and `content/pt-br/about.mdx` MUST exist with frontmatter populated per the indie-dev minimal structure: `title` (string, required), `locale` (enum, required), `links` (array of `{label, url, kind}`, optional, defaults to empty).
- A new module `app/lib/mdx/about.server.ts` MUST export `aboutFrontmatterSchema` (Zod), `type AboutFrontmatter` (`z.infer` of the schema), `type AboutContent`, and `async function loadAbout(locale: Locale): Promise<AboutContent>`.
- `loadAbout` MUST read `content/<locale>/about.mdx`, validate frontmatter with the schema, compile MDX body to HTML via `renderMdx`, and return the populated `AboutContent`.
- When `content/<locale>/about.mdx` is missing for the requested locale, `loadAbout` MUST fall back to `DEFAULT_LOCALE`, set `fallbackLocale` on the result, and let the component render the `TranslationNotice` banner.
- The new route `app/routes/{-$locale}/about.tsx` + `about.server.ts` MUST replace the legacy `app/routes/about.tsx` (which MUST be deleted).
- The route MUST render hreflang pairs `<link rel="alternate" hreflang="en" href="/about">` and `<link rel="alternate" hreflang="pt-br" href="/pt-br/about">` in the SSR head.
- When fallback content is rendered, the article element MUST set `lang="en"` (or the actual content language) for a11y/SEO correctness.
- Existing tests `app/tests/public-routes.test.ts:154` and `app/tests/header.test.ts:149` MUST be rewritten to assert locale-aware About routing.
- A real photo asset MUST replace the current placeholder; location (e.g., `public/about/avatar.jpg`) and reference mechanism are determined during implementation.
</requirements>

## Subtasks
- [x] 13.1 Author `content/en/about.mdx` with indie-dev minimal sections (identity, photo reference, bio, Now, contact)
- [x] 13.2 Author `content/pt-br/about.mdx` with the parallel pt-br content (or stub with required frontmatter if pt-br copy is not ready)
- [x] 13.3 Create `app/lib/mdx/about.server.ts` with `aboutFrontmatterSchema`, types, and `loadAbout`
- [x] 13.4 Create `app/routes/{-$locale}/about.tsx` + `about.server.ts` with loader wiring and component
- [x] 13.5 Add hreflang pairs to the About route head
- [x] 13.6 Delete `app/routes/about.tsx`
- [x] 13.7 Rewrite the two affected tests for locale-aware About routing
- [x] 13.8 Add unit + integration tests for the new code paths

## Implementation Details
See TechSpec "Implementation Design → Core Interfaces" code blocks "About frontmatter schema" and "About loader contract" for the module shape. See ADR-006 for the no-DB storage decision and ADR-007 for Zod adoption. The `TranslationNotice` component (currently used by post detail) is the reference for the fallback banner UX.

### Relevant Files
- (new) `content/en/about.mdx`
- (new) `content/pt-br/about.mdx`
- (new) `app/lib/mdx/about.server.ts`
- (new) `app/routes/{-$locale}/about.tsx` + `about.server.ts`
- `app/lib/mdx/parser.server.ts` — existing frontmatter parser
- `app/lib/mdx/renderer.server.ts` — existing MDX renderer
- `app/lib/locale.tsx` — `Locale`, `LOCALES`, `DEFAULT_LOCALE`
- `app/routes/{-$locale}/$slug.tsx` — reference pattern for hreflang + TranslationNotice fallback

### Dependent Files
- `app/routes/about.tsx` — to be deleted
- `app/tests/public-routes.test.ts:154` — rewrite assertion for locale-aware About
- `app/tests/header.test.ts:149` — rewrite assertion for About in lang switcher fallback
- `app/components/layout/header.tsx` — `NAV_LABELS` includes About; verify path resolves correctly

### Related ADRs
- [ADR-006: About Page Served from MDX Without DB](adrs/adr-006.md) — storage strategy
- [ADR-007: Adopt Zod](adrs/adr-007.md) — schema validation
- [ADR-001: V1 Scope](adrs/adr-001.md) — About MDX migration
- [ADR-002: 3-Phase Rollout](adrs/adr-002.md) — Phase 3

## Deliverables
- Two MDX content files (en + pt-br)
- New helper module with Zod schema + loader
- New route file pair (component + server fn)
- Hreflang pairs on About route
- Legacy `app/routes/about.tsx` deleted
- Two affected tests rewritten
- Photo asset referenced (real, not placeholder)
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for full About route with fallback behavior **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `aboutFrontmatterSchema.parse` succeeds on valid en frontmatter from the seeded MDX file
  - [ ] `aboutFrontmatterSchema.parse` succeeds on valid pt-br frontmatter
  - [ ] `aboutFrontmatterSchema.parse` throws ZodError when `title` is missing
  - [ ] `aboutFrontmatterSchema.parse` throws ZodError when `locale` is outside `LOCALES`
  - [ ] `aboutFrontmatterSchema.parse` allows omitted `links[]` and resolves to an empty array
  - [ ] `aboutFrontmatterSchema.parse` rejects a `link` entry whose `kind` is outside the enum
  - [ ] `loadAbout("en")` returns parsed content, html, and `locale: "en"` with no `fallbackLocale`
  - [ ] `loadAbout("pt-br")` returns parsed pt-br content
  - [ ] `loadAbout("pt-br")` against a directory missing `pt-br/about.mdx` falls back to en and sets `fallbackLocale: "en"`
- Integration tests:
  - [ ] SSR `GET /about` returns 200 with en About content, hreflang pairs in head, and `lang="en"` on article wrapper
  - [ ] SSR `GET /pt-br/about` returns 200 with pt-br About content and the matching hreflang pair
  - [ ] After temporarily removing `content/pt-br/about.mdx`, SSR `GET /pt-br/about` falls back to en content with `lang="en"` and the `TranslationNotice` banner rendered
  - [ ] The rewritten `public-routes.test.ts` assertion passes against the new About URL
  - [ ] The rewritten `header.test.ts` assertion passes for the new About route in the lang switcher fallback
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `/about` and `/pt-br/about` render real, non-placeholder content from the MDX files
- Legacy `app/routes/about.tsx` removed from the git tree
- Fallback locale handling verified end-to-end with `lang` attribute and translation banner
- Photo asset is a real image, not a placeholder
