# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/lib/locale.tsx` — locale state primitive mirroring `theme.tsx` pattern.

## Important Decisions

- Used `/\bpt\b/i` regex for Accept-Language detection (matches pt, pt-BR, pt-PT etc.)
- Test file is `.test.ts` (not `.tsx`) — wrapper uses `React.createElement` instead of JSX
- Added `// @vitest-environment jsdom` annotation for localStorage + React hook tests
- No cookie-based stored locale detection in `detectLocaleFromRequest` — ADR-004 chose localStorage (client-side) over cookies; server function only reads Accept-Language

## Learnings

- vite.config.ts test include only covers `*.test.ts` — `.test.tsx` files are excluded; use `React.createElement` for wrappers in `.ts` test files
- Pre-existing `ReferenceError: module is not defined` in jsdom env and `close timed out` warning are not caused by this task; both are pre-existing issues
- `noUnusedLocals: true` in tsconfig — all imported symbols must be used

## Files / Surfaces

- `app/lib/locale.tsx` — new, all exports
- `app/tests/locale.test.ts` — new, 8 tests (5 detectLocaleFromRequest, 3 LocaleProvider+useLocale)

## Errors / Corrections

- Biome flagged import order (LocaleProvider before detectLocaleFromRequest) — fixed alphabetically
- Biome flagged line-too-long on expect call — broke into multi-line

## Ready for Next Run

task_04 complete. task_05 (Root Wrapper + Locale Layout Route) imports `LocaleProvider` from `app/lib/locale.tsx` and `LOCALES` from same file — both exported and ready.
