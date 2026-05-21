# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Add `RouteKind` discriminated union + `getTwinAvailabilityForCurrentRoute` to `app/lib/locale.tsx`.
Create `app/components/ui/language-menu.tsx` with per-item `available` prop.
Extend `app/tests/locale.test.ts` and `app/tests/header.test.ts` with new tests.

## Status: COMPLETE

Committed: `421847b feat(i18n): add RouteKind + getTwinAvailabilityForCurrentRoute + LanguageMenu available state`

All 66 tests pass (locale.test.ts + header.test.ts).

## Important Decisions

- `RouteKind.page` carries `hasTwin: boolean` (precomputed by loader) — TechSpec shows `{ kind: "page"; slug: string }` but unit test spec and requirement both say "via the precomputed boolean." Added `hasTwin: boolean` to page variant to keep function pure.
- `getTwinAvailabilityForCurrentRoute` uses `_targetLocale` param (unused internally since hasTwin is precomputed) — included in signature per TechSpec for future extensibility.
- AC-3 admin returns `{ available: false, renderSwitcher: false }` — spec says `{ renderSwitcher: false }` which is the key part; full type requires `available` field.
- `language-menu.tsx` is a NEW file (didn't exist in worktree). Created as pure presentational component.
- NOT_AVAILABLE_HINT uses placeholder copy: en="(not available)", pt-br="(indisponível)". Final copy locked per PRD Q-O1.
- `aria-disabled="true"` (not `disabled`) so onClick still fires — modal-trigger seam for task_10.

## Files / Surfaces

- `app/lib/locale.tsx` — added RouteKind type + getTwinAvailabilityForCurrentRoute
- `app/components/ui/language-menu.tsx` — created new file
- `app/tests/locale.test.ts` — added getTwinAvailabilityForCurrentRoute tests
- `app/tests/header.test.ts` — added LanguageMenu render tests

## Learnings

- `language-menu.tsx` did not exist in the worktree — task creates it from scratch.
- Only Radix dep is `@radix-ui/react-dialog` — no Radix DropdownMenu dep. LanguageMenu is plain HTML ul/li.
- header.test.ts mocks @tanstack/react-router (Link, useNavigate, useRouterState) and matchMedia. New LanguageMenu tests don't need those mocks.

## Ready for Next Run

- task_10 imports `RouteKind`, `getTwinAvailabilityForCurrentRoute` from `app/lib/locale.tsx`
- task_10 consumes `LanguageMenu` from `app/components/ui/language-menu.tsx` with `available` prop
