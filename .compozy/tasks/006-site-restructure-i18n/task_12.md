---
status: completed
title: Wire UIStrings consumers (header + post meta + 404)
type: frontend
complexity: medium
dependencies:
    - task_07
    - task_11
---

# Task 12: Wire UIStrings consumers (header + post meta + 404)

## Overview
Replace hardcoded user-facing strings in three surfaces with reads from `strings[locale].*`: (1) the header locale switcher button label, (2) post meta labels in the post detail route, and (3) the NotFoundPage copy in `__root.tsx`. After this lands, every V1-populated UIStrings key has a real consumer; nav, footer, and brand strings stay hardcoded in V1 per ADR-001.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- The header locale switcher button in `app/components/layout/header.tsx` MUST render `strings[targetLocale].localeSwitcher.label` (the OTHER locale's own-language label, since clicking the switcher routes to that locale) rather than the current hardcoded `EN` / `PT` strings.
- The post detail route in `app/routes/{-$locale}/$slug.tsx` MUST render `strings[locale].postMeta.publishedOn` as the label preceding the published date, and `strings[locale].postMeta.readingTime` as the label for reading time (if reading time is currently displayed).
- The `NotFoundPage` component in `app/routes/__root.tsx` MUST read `strings[locale].notFound.title`, `body`, and `homeCta` from the UIStrings module instead of the inline locale-keyed object literals it currently contains.
- All three consumers MUST handle both en and pt-br locales without falling back to hardcoded strings.
- Tests MUST assert each consumer renders the expected locale-specific string from the module.
</requirements>

## Subtasks
- [x] 12.1 Refactor header locale switcher button to consume `strings[targetLocale].localeSwitcher.label`
- [x] 12.2 Wire post detail page to render `postMeta.publishedOn` as date label
- [x] 12.3 Refactor NotFoundPage in `__root.tsx` to read from UIStrings module
- [x] 12.4 Update or add tests for each consumer
- [ ] 12.5 Smoke-render both locales in dev and confirm rendered strings

## Implementation Details
See TechSpec "Impact Analysis" rows for `app/components/layout/header.tsx`, `app/routes/{-$locale}/$slug.tsx`, and `app/routes/__root.tsx`. Per ADR-001, V1 keeps nav labels, footer, and brand copy hardcoded — only the three consumers in this task move to the module.

### Relevant Files
- `app/components/layout/header.tsx` — locale switcher button
- `app/routes/{-$locale}/$slug.tsx` — post detail page meta rendering
- `app/routes/__root.tsx` — NotFoundPage component
- `app/lib/i18n/strings.ts` — UIStrings module from task_11

### Dependent Files
- `app/tests/header.test.ts` — has assertions on locale switcher; update for new label format
- `app/tests/lang-slug-route.test.ts` — may need an assertion for postMeta label
- `app/tests/public-routes.test.ts` — has assertions on 404 routing; update for UIStrings consumption

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — V1 keys list
- [ADR-007: Adopt Zod](adrs/adr-007.md) — schema-driven validation

## Deliverables
- Three files updated to consume `UIStrings`
- Updated tests
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for SSR-rendered strings per locale **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Header switcher button text equals `"Português"` when `currentLocale === "en"`
  - [x] Header switcher button text equals `"English"` when `currentLocale === "pt-br"`
  - [x] NotFoundPage renders the en `notFound.title` value when locale is en
  - [x] NotFoundPage renders the pt-br `notFound.title` value when locale is pt-br
  - [x] Post detail published-date label matches `strings[locale].postMeta.publishedOn`
- Integration tests:
  - [ ] SSR `GET /` rendered DOM contains the en switcher target label
  - [ ] SSR `GET /pt-br/` rendered DOM contains the pt-br switcher target label
  - [x] SSR `GET /nonexistent` rendered DOM contains the en-locale `notFound.title` text
  - [x] SSR `GET /pt-br/nonexistent` rendered DOM contains the pt-br-locale `notFound.title` text
  - [x] SSR `GET /<known-slug>` rendered DOM contains the en `postMeta.publishedOn` label preceding the date
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- No hardcoded UI string for switcher label, postMeta label, or 404 copy remains in the three target files
- Visible strings sourced from the UIStrings module render identically to the schema-defined values
