---
status: completed
title: Add `RouteKind` + `getTwinAvailabilityForCurrentRoute` + per-item `available` state in language menu
type: frontend
complexity: medium
dependencies:
    - task_03
feature: i18n/language-switcher
---

# Task 09: Add `RouteKind` + `getTwinAvailabilityForCurrentRoute` + per-item `available` state in language menu

## Overview
Build the twin-availability surface that task_10's switcher rewrite consumes. Add the `RouteKind` discriminated union and the `getTwinAvailabilityForCurrentRoute` helper to `app/lib/locale.tsx` per TechSpec "Core Interfaces". Update `app/components/ui/language-menu.tsx` so each `<DropdownMenuItem>` carries an `available: boolean` prop, rendering an inline "(not available)" hint plus `aria-disabled="true"` semantics when `false` (the item remains clickable so task_10 can intercept and open the modal).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `RouteKind` (tagged union: `post | page | structural | admin`) and `getTwinAvailabilityForCurrentRoute(route, targetLocale)` to `app/lib/locale.tsx`.
- MUST dispatch per route kind: post → `PostEntry.hasTwin`; page → `staticPageHasTwin(slug, targetLocale)`; structural → `available: true`; admin → `renderSwitcher: false`.
- MUST extend `language-menu.tsx` with a per-item `available` prop (default `true` so existing call sites stay green until task_10 rewires them).
- MUST render the "(not available)" hint via an inline `Record<Locale, string>` so the hint string itself is localized (placeholder copy acceptable; final copy locked in PRD Q-O1).
- MUST set `aria-disabled="true"` (not `disabled`) so the click handler still fires for the modal-trigger seam.
- MUST NOT compute `staticPageHasTwin` synchronously inside a React render path — the helper should accept a precomputed boolean already resolved by the route loader.
</requirements>

## Subtasks
- [x] 09.1 Add `RouteKind` type and `getTwinAvailabilityForCurrentRoute` to `app/lib/locale.tsx`.
- [x] 09.2 Extend `app/components/ui/language-menu.tsx` props to accept per-item `available`.
- [x] 09.3 Render the hint label + `aria-disabled` when `available === false`.
- [x] 09.4 Add inline `Record<Locale, string>` for the hint copy (placeholder strings; final copy is Q-O1).
- [x] 09.5 Extend `app/tests/locale.test.ts` to cover `getTwinAvailabilityForCurrentRoute` per route kind.
- [x] 09.6 Extend `app/tests/header.test.ts` to cover the per-item rendering states.

## Implementation Details
See TechSpec "Core Interfaces" → `RouteKind` + `getTwinAvailabilityForCurrentRoute`. The dispatch logic is documented in ADR-003. The existing inline-string convention in `language-menu.tsx:6-24` is the pattern to mirror for the hint copy.

### Relevant Files
- `app/lib/locale.tsx` — destination for the helper + union type.
- `app/components/ui/language-menu.tsx:6-24` — inline-string convention to mirror.
- `app/lib/site-model.server.ts:268-279` — `PostEntry.hasTwin` source for post routes.
- `app/lib/mdx/pages.server.ts` — `staticPageHasTwin` source for page routes (from task_03).

### Dependent Files
- Task_10 imports the helper from `app/lib/locale.tsx` and consumes the extended `language-menu.tsx` props.

### Related ADRs
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — defines the per-item state semantics.

## Acceptance Criteria
1. AC-1: `getTwinAvailabilityForCurrentRoute({ kind: "post", slug: "x", hasTwin: false }, "pt-br")` returns `{ available: false, renderSwitcher: true }`.
2. AC-2: `getTwinAvailabilityForCurrentRoute({ kind: "structural" }, "pt-br")` returns `{ available: true, renderSwitcher: true }`.
3. AC-3: `getTwinAvailabilityForCurrentRoute({ kind: "admin" }, "pt-br")` returns `{ renderSwitcher: false }` (admin hides the menu entirely).
4. AC-4: When `<LanguageMenu>` receives an item with `available={false}`, the rendered DOM has the hint text and `aria-disabled="true"`; the item's `onClick` handler still fires when clicked.

## Deliverables
- Updated `app/lib/locale.tsx`.
- Updated `app/components/ui/language-menu.tsx`.
- Extended unit tests in `app/tests/locale.test.ts` and `app/tests/header.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for menu render states **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `getTwinAvailabilityForCurrentRoute` for each `RouteKind` variant (post w/wo twin, page w/wo twin via the precomputed boolean, structural, admin).
  - [ ] `<LanguageMenu>` renders hint text + `aria-disabled` for an item with `available={false}`.
  - [ ] `<LanguageMenu>` does NOT render the hint when `available={true}`.
  - [ ] `<LanguageMenu>` click handler fires even when `available={false}`.
- Integration tests:
  - [ ] Render `<LanguageMenu>` with a mixed-availability item set (one available, one not); assert correct DOM for both.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Twin-availability helper returns expected output for every `RouteKind`
- Menu item click still fires when `available={false}` (modal-trigger seam preserved)
