---
status: completed
title: Rewrite `useLangSwitcher` + e2e flow tests
type: frontend
complexity: high
dependencies:
    - task_08
    - task_09
feature: i18n/language-switcher
---

# Task 10: Rewrite `useLangSwitcher` + e2e flow tests

## Overview
Replace the hardcoded `if`-chain in `app/components/layout/header.tsx:49-71` with TanStack Router's idiomatic `<Link params={(prev) => ({ ...prev, locale: targetLocale })}>` form, intercepting clicks on items whose `available` state is `false` to open task_08's `<MissingTwinDialog>`. Hide the language menu entirely on `/admin/*` routes. Extend the Playwright suite to cover en → pt-br round-trip (currently broken per `tests/e2e/public-read.spec.ts:77`), menu-hint render state, modal-confirm path, and modal-cancel path.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remove the hardcoded `if (route === "blog")` / `if (route === "about")` / `if (route === "$slug")` chain in `app/components/layout/header.tsx:49-71`.
- MUST use `<Link params={(prev) => ({ ...prev, locale: targetLocale })}>` so the current route is preserved across locales.
- MUST intercept clicks on items with `available === false`, calling `event.preventDefault()` and opening `<MissingTwinDialog>` in the current page's locale with the target locale.
- MUST hide the language menu (`renderSwitcher === false` from `getTwinAvailabilityForCurrentRoute`) on `/admin/*` routes.
- MUST extend `tests/e2e/public-read.spec.ts` with the four scenarios listed in TechSpec "Testing Approach → E2E Tests".
- MUST NOT change the menu's visual appearance for items that are available — the hint is the only visual delta.
</requirements>

## Subtasks
- [x] 10.1 Replace the if-chain in `useLangSwitcher` with `<Link params={(prev) => ...}>` and an `onClickCapture` interceptor.
- [x] 10.2 Wire `<MissingTwinDialog>` mount/unmount via React state in the header layout.
- [x] 10.3 Gate the menu rendering on `renderSwitcher` from `getTwinAvailabilityForCurrentRoute` (hides on `/admin/*`).
- [x] 10.4 Compute `available` per locale option using the helper from task_09 and pass through to `<LanguageMenu>`.
- [x] 10.5 Extend `tests/e2e/public-read.spec.ts` with: en → pt-br round-trip, menu hint render, modal confirm, modal cancel.

## Implementation Details
See TechSpec "System Architecture → Data Flow" (switcher click branch) and "Testing Approach → E2E Tests" for the test scenarios. The TanStack Router function-form params pattern is documented in their routing guide and was identified as the missing primitive in the idea phase research.

### Relevant Files
- `app/components/layout/header.tsx:37-74,113-120,207-214` — `useLangSwitcher` hook + desktop and mobile triggers.
- `app/components/ui/language-menu.tsx` — extended in task_09 with `available` prop.
- `app/components/ui/missing-twin-dialog.tsx` — from task_08.
- `app/lib/locale.tsx` — `getTwinAvailabilityForCurrentRoute` from task_09.
- `tests/e2e/public-read.spec.ts:68-86` — existing locale-switcher coverage to extend; `:77` documents the broken en → pt-br case.

### Dependent Files
- `app/tests/header.test.ts` — unit tests may need re-expectations for the new switcher shape.

### Related ADRs
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — the consuming UX this task implements.
- [ADR-006: Modal primitive = `@radix-ui/react-dialog`](adrs/adr-006.md) — supplies the modal underneath.
- [ADR-005: Unified `$slug` loader](adrs/adr-005.md) — supplies the route data the switcher dispatches on.

## Acceptance Criteria
1. AC-1: On a post route with both locale twins present, clicking the target-locale menu item navigates directly to the twin (no modal).
2. AC-2: On a post route where the target locale has no twin, clicking the menu item opens `<MissingTwinDialog>`; the dialog copy is in the current page's locale.
3. AC-3: Confirming the modal navigates to the target-locale home (`/` or `/pt-br/`); cancelling closes the modal and leaves the URL unchanged; focus returns to the menu item that triggered it.
4. AC-4: On any `/admin/*` route the language menu is not rendered.
5. AC-5: The en → pt-br round-trip case currently broken at `tests/e2e/public-read.spec.ts:77` now passes; the existing pt-br → en case continues to pass.

## Deliverables
- Rewritten `useLangSwitcher` in `app/components/layout/header.tsx`.
- Extended `tests/e2e/public-read.spec.ts` covering the four new scenarios.
- Updated unit tests in `app/tests/header.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the modal flow **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `useLangSwitcher` returns the correct target href given the current route + target locale (post route, page route, structural route).
  - [ ] Clicking an `available={false}` menu item triggers the modal-open state.
  - [ ] Clicking an `available={true}` menu item does NOT trigger the modal.
  - [ ] Switcher is not rendered when `renderSwitcher === false` (admin route).
- Integration tests (Playwright):
  - [ ] en → pt-br round-trip on a fixture post that has both twins: assert URL change, no modal.
  - [ ] Menu-hint render: open menu on en-only fixture post, assert "(not available)" text on the pt-br option, assert `aria-disabled="true"`.
  - [ ] Modal-confirm path: click pt-br option on en-only post, assert dialog open, click confirm, assert URL = `/pt-br/`.
  - [ ] Modal-cancel path: same setup, click cancel, assert dialog closed, URL unchanged, focus on the originating menu item.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- The home-redirect bug is gone — switcher never silently dumps a reader on home when a twin exists
- Modal flow is keyboard-accessible end-to-end (Escape cancels, Enter confirms when focus is on the confirm button)
