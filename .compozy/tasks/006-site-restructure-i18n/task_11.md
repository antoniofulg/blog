---
status: completed
title: Create typed UIStrings module + Zod schema
type: frontend
complexity: medium
dependencies:
    - task_10
---

# Task 11: Create typed UIStrings module + Zod schema

## Overview
Create `app/lib/i18n/strings.ts` exposing the typed `UIStrings` shape, a Zod schema (`uiStringsSchema`), and the populated `strings: Record<Locale, UIStrings>` constant. Per PRD F5 and ADR-001, V1 populates only the keys that Portuguese post rendering needs: locale switcher labels (own-language form: "English" / "Português"), post meta labels, and locale-aware 404 copy. The module validates each locale's strings against the schema at import time so missing required keys fail loudly.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `app/lib/i18n/strings.ts` MUST export `uiStringsSchema`, `type UIStrings`, and `const strings: Record<Locale, UIStrings>`.
- `type UIStrings` MUST be derived via `z.infer<typeof uiStringsSchema>` so type and runtime shape stay in sync.
- The schema MUST define keys: `localeSwitcher.label`, `postMeta.publishedOn`, `postMeta.readingTime`, `notFound.title`, `notFound.body`, `notFound.homeCta`.
- Module load MUST iterate `LOCALES` and call `uiStringsSchema.parse(strings[locale])` per locale — invalid shape throws at import time.
- `strings.en.localeSwitcher.label` MUST be the literal string `"English"`; `strings["pt-br"].localeSwitcher.label` MUST be `"Português"`.
- Tests MUST cover schema validation success, validation failure on missing required keys, and the en/pt-br value contracts.
</requirements>

## Subtasks
- [x] 11.1 Create `app/lib/i18n/` directory and `strings.ts` skeleton
- [x] 11.2 Define `uiStringsSchema` covering all V1 keys
- [x] 11.3 Populate `strings` constant for both en and pt-br
- [x] 11.4 Add module-load validation loop iterating `LOCALES`
- [x] 11.5 Add unit tests covering schema and value contracts

## Implementation Details
See TechSpec "Implementation Design → Core Interfaces" code blocks "UIStrings schema" and "UIStrings module exports" for the file shape (note: code shown in TechSpec is illustrative; this task implements the module). See ADR-007 for Zod adoption scope and ADR-001 for the V1 keys list.

### Relevant Files
- (new) `app/lib/i18n/strings.ts` — module to create
- `app/lib/locale.tsx` — provides `Locale` type and `LOCALES` constant

### Dependent Files
- task_12 wires consumers (header, post detail, 404 page)
- task_13 (About) does not consume `UIStrings` directly — About has its own schema

### Related ADRs
- [ADR-007: Adopt Zod](adrs/adr-007.md) — validation primitive
- [ADR-001: V1 Scope](adrs/adr-001.md) — typed i18n contract with V1 partial population

## Deliverables
- New `app/lib/i18n/strings.ts` module
- Schema definition + populated strings for en + pt-br
- Module-load validation loop
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration test verifying module import does not throw **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `uiStringsSchema.parse(strings.en)` returns the en object unchanged
  - [x] `uiStringsSchema.parse(strings["pt-br"])` returns the pt-br object unchanged
  - [x] `uiStringsSchema.parse({})` throws ZodError for missing `localeSwitcher`
  - [x] `uiStringsSchema.parse({ localeSwitcher: { label: "English" } })` throws ZodError for missing `postMeta`
  - [x] `uiStringsSchema.parse({ localeSwitcher: {...}, postMeta: {...}, notFound: {} })` throws ZodError for missing `notFound.title`
  - [x] `strings.en.localeSwitcher.label === "English"`
  - [x] `strings["pt-br"].localeSwitcher.label === "Português"`
- Integration tests:
  - [x] Importing the module at runtime does not throw (validation loop succeeds)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Module loads without throwing under both en and pt-br locale rendering paths
- Schema + type stay in sync via `z.infer`
