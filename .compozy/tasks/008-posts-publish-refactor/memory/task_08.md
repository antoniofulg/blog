# Task Memory: task_08.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/components/ui/missing-twin-dialog.tsx` — controlled confirm modal for missing-twin flow. Task complete.

## Important Decisions

- `language-menu.tsx` was deleted from the TASK-0008 branch by a prior task. `localeLabel` source doesn't exist in worktree. Defined `LOCALE_NAMES` inline in `missing-twin-dialog.tsx` (exported so task_09 can import it when rewriting `language-menu.tsx`).
- Used "Português (BR)" for `pt-br` locale label (AC-1 requires it explicitly; original `language-menu.tsx` used "Português").
- Dialog controlled via `open` prop. `onOpenChange` handles Escape/overlay close → `onCancel()`. Cancel button calls `onCancel()` directly (not `RadixDialog.Close`) to avoid double-fire when parent sets `open=false`.

## Learnings

- Vitest `include` pattern is `*.test.ts` only — test files must use `.ts` extension, not `.tsx`. Use `React.createElement` in tests (consistent with `dialog.test.ts`).

## Files / Surfaces

- NEW: `app/components/ui/missing-twin-dialog.tsx`
- NEW: `app/tests/missing-twin-dialog.test.ts`

## Errors / Corrections

- Biome `organizeImports`: `#/lib/locale` import must come after `#/components/ui/dialog` (alphabetical). Fixed.

## Ready for Next Run

Task_10 imports `<MissingTwinDialog>` from `#/components/ui/missing-twin-dialog`. Also exports `LOCALE_NAMES` — task_09 should import it instead of re-defining.
