---
status: completed
title: Add `@radix-ui/react-dialog` + `app/components/ui/dialog.tsx` wrapper
type: frontend
complexity: low
dependencies: []
feature: i18n/language-switcher
---

# Task 07: Add `@radix-ui/react-dialog` + `app/components/ui/dialog.tsx` wrapper

## Overview
Install the Radix Dialog primitive and build a thin shadcn-style wrapper at `app/components/ui/dialog.tsx` per ADR-006. The wrapper exposes a compound API (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`) so the missing-twin dialog (task_08) and any future modal can consume it without re-binding Radix internals.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `@radix-ui/react-dialog` as a runtime dependency via `bun add`.
- MUST create `app/components/ui/dialog.tsx` exposing the named compound exports listed in TechSpec "Core Interfaces" → Dialog wrapper section.
- MUST style with Tailwind utility classes — no new design tokens, no CSS module.
- MUST render correctly under SSR — guard portal mount so the server output does not flash dialog contents pre-hydration.
- MUST follow the shadcn/ui Dialog wrapper pattern so a future switch to the shadcn CLI is a copy-paste, not a rewrite.
- MUST NOT introduce additional Radix packages (no `@radix-ui/react-portal`, no `@radix-ui/react-slot`) beyond what `react-dialog` requires transitively.
</requirements>

## Subtasks
- [ ] 07.1 Run `bun add @radix-ui/react-dialog`; confirm peer-dep React 19 alignment.
- [ ] 07.2 Create `app/components/ui/dialog.tsx` with the compound exports.
- [ ] 07.3 Tailwind styling — overlay, content, header, footer, close button.
- [ ] 07.4 SSR guard for the portal (mounted flag in the wrapper if Radix default produces a hydration warning).
- [ ] 07.5 Smoke render in Vitest — assert the exports exist and the wrapper composes correctly.

## Implementation Details
See TechSpec "Core Interfaces" → Dialog wrapper section. The shadcn/ui dialog wrapper at https://ui.shadcn.com/docs/components/dialog is the reference shape.

### Relevant Files
- `package.json` — add the new dep.
- `app/components/ui/` — destination directory.
- `app/components/ui/language-menu.tsx:6-24` — existing inline-string convention to mirror in the wrapper's prop types if any default copy is needed.

### Dependent Files
- Task_08 imports the wrapper to build `<MissingTwinDialog>`.
- `app/tests/dialog.test.ts` (new) — smoke tests added in this task.

### Related ADRs
- [ADR-006: Modal primitive = `@radix-ui/react-dialog`](adrs/adr-006.md) — directly implements this ADR.

## Acceptance Criteria
1. AC-1: `@radix-ui/react-dialog` appears in `package.json` `dependencies` and resolves via `bun install`.
2. AC-2: `app/components/ui/dialog.tsx` exports `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` (all named, in the shadcn wrapper shape).
3. AC-3: A Vitest smoke test imports the wrapper and renders `<Dialog><DialogTrigger>open</DialogTrigger><DialogContent><DialogTitle>t</DialogTitle></DialogContent></Dialog>` without throwing under JSDOM.
4. AC-4: Server-rendered HTML for the page containing the wrapper does not include the open `<DialogContent>` portal markup before client mount (SSR guard verified).

## Deliverables
- Updated `package.json` + `bun.lock`.
- New `app/components/ui/dialog.tsx`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the SSR guard **(REQUIRED)**

## Tests
- Unit tests:
  - [x] All compound exports exist on import.
  - [x] `<Dialog>` opens on `<DialogTrigger>` click — JSDOM render assertion.
  - [x] `<Dialog>` closes on Escape — JSDOM keypress assertion.
  - [x] `<DialogClose>` button click closes the dialog.
- Integration tests:
  - [x] SSR snapshot of a page that mounts a closed dialog contains no `<DialogContent>` markup before hydration.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Wrapper API matches shadcn/ui Dialog convention
- No hydration warning when the dialog is mounted closed in SSR pages
