---
status: completed
title: Create `missing-twin-dialog.tsx`
type: frontend
complexity: low
dependencies:
    - task_07
feature: i18n/language-switcher
---

# Task 08: Create `missing-twin-dialog.tsx`

## Overview
Build the concrete missing-twin confirm modal at `app/components/ui/missing-twin-dialog.tsx` composing task_07's `<Dialog>` wrapper. Copy is rendered in the **current page's language** per PRD Q-PRD2 lock, using an inline `Record<Locale, { title; body; confirm; cancel }>` to match the existing inline-string pattern at `app/components/ui/language-menu.tsx:6-24`. The dialog accepts a target locale and emits confirm / cancel callbacks the switcher (task_10) intercepts.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST accept props `{ open: boolean; currentLocale: Locale; targetLocale: Locale; onConfirm: () => void; onCancel: () => void; }`.
- MUST render the title, body, confirm-button label, and cancel-button label in `currentLocale`.
- MUST interpolate `targetLocale`'s human-readable name into the body (e.g., "Português (BR)" or "English") using the existing locale-label source from `language-menu.tsx`.
- MUST use the `<Dialog>` compound from task_07 (no direct Radix imports).
- MUST trap focus, return focus to the originating element on close, and handle Escape (all delegated to the Radix wrapper).
- MUST NOT execute the redirect itself — `onConfirm` is the seam the switcher uses; the dialog only signals intent.
</requirements>

## Subtasks
- [x] 08.1 Define the props type and the inline `COPY: Record<Locale, { title; body; confirm; cancel }>` constant.
- [x] 08.2 Compose `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>` with the localized strings.
- [x] 08.3 Wire confirm and cancel buttons to the prop callbacks; close the dialog on either.
- [x] 08.4 Pull the human-readable locale labels from the existing `localeLabel` source in `language-menu.tsx` (do not duplicate the table).
- [x] 08.5 Add Vitest coverage for both locales' copy + both action paths.

## Implementation Details
See TechSpec "System Architecture → Component Overview" row for `missing-twin-dialog.tsx`. Copy strings live inline per PRD "High-Level Technical Constraints" (no central i18n catalog in V1).

### Relevant Files
- `app/components/ui/dialog.tsx` — wrapper from task_07.
- `app/components/ui/language-menu.tsx:6-24` — source of `localeLabel`, `triggerLabelByLocale`, etc.; reuse for human-readable target-locale names.
- `app/lib/locale.tsx` — `Locale` type.

### Dependent Files
- Task_10 consumes `<MissingTwinDialog>` from the switcher rewrite.

### Related ADRs
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — defines the modal trigger semantics this component fulfills.
- [ADR-006: Modal primitive = `@radix-ui/react-dialog`](adrs/adr-006.md) — supplies the underlying wrapper.

## Acceptance Criteria
1. AC-1: When `currentLocale = "en"` and `targetLocale = "pt-br"`, the rendered title is in English and the body references "Português (BR)".
2. AC-2: When `currentLocale = "pt-br"` and `targetLocale = "en"`, the rendered title is in Portuguese and the body references "English".
3. AC-3: Clicking the confirm button calls `onConfirm` exactly once; clicking cancel calls `onCancel` exactly once; neither fires the other.
4. AC-4: The dialog closes on Escape, and focus returns to the element that was focused before it opened (verified via the Radix wrapper from task_07).

## Deliverables
- New `app/components/ui/missing-twin-dialog.tsx`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for both action paths **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Renders English copy when `currentLocale === "en"`.
  - [x] Renders Portuguese copy when `currentLocale === "pt-br"`.
  - [x] Body string contains the human-readable name of `targetLocale`.
  - [x] `onConfirm` invoked exactly once on confirm-button click; `onCancel` not invoked.
  - [x] `onCancel` invoked exactly once on cancel-button click; `onConfirm` not invoked.
- Integration tests:
  - [x] Mount with `open={true}` then close via Escape — assert `onCancel` (or analogous close handler) fires.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Copy renders in the current page's language (PRD Q-PRD2 lock)
- No direct Radix imports — wrapper from task_07 is the only seam
