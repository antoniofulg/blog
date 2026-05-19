---
name: task-06-lint-test-annotations
description: Execution context for task_06: lint-test-annotations script + scripts wiring
metadata:
  type: project
---

## Objective Snapshot

Implement `scripts/lint-test-annotations.ts` — AST-based CI lint script enforcing 48h SLA on `@flaky`, `.skip`, `.todo` annotations in `tests/e2e/**/*.ts`. Add `lint:tests` script + `lint-tests` Makefile target.

## Important Decisions

- Used TypeScript compiler API (`typescript` package, already installed as devDep at 6.0.3) for AST parsing — not regex. `ts.createSourceFile` + `ts.forEachChild` walk.
- Date comment detection uses raw line scan (same line or preceding line) rather than TS leading-comment API — simpler and correct.
- Exported `scanFile(content, relPath)` and `scanDir(dir, cwd)` as testable functions; main guard via `import.meta.main`.
- `readdir` with `{ withFileTypes: true }` returns `Dirent<string>[]` in TypeScript 6.x but type annotation defaults to `Dirent<NonSharedBuffer>[]` — fix: extract helper `safeReaddir()` and cast `entry.name as string`.
- Fixture files use `// @ts-nocheck` (not `export {}`) to avoid biome `noExportsInTest` error while still preventing TS redeclaration errors.

## Learnings

- `isoAgo(1)` returns midnight UTC of yesterday; `computeAgeHours` measures from midnight, so result is not exactly 24h — use range check (`>0 && <48`) not `toBeCloseTo(24)`.
- `playwright-report/` left by task_05 causes biome `lint/style/useTemplate` warning in `index.html`. Pre-existing; deleted on task_06 run since it's gitignored.
- `biome lint` exits 1 on errors (not warnings); `noExportsInTest` is an ERROR not a warning.
- `coverage/` directory (gitignored) was untracked per git status; biome includes `**/index.html` which caught coverage HTML — pre-existing warning, not an error.

## Files / Surfaces

- `scripts/lint-test-annotations.ts` — new
- `app/tests/lint-test-annotations.test.ts` — new
- `app/tests/fixtures/lint-annotations/clean.ts` — new
- `app/tests/fixtures/lint-annotations/expired-skip.ts` — new
- `app/tests/fixtures/lint-annotations/missing-date-todo.ts` — new
- `app/tests/fixtures/lint-annotations/string-literal-flaky.ts` — new
- `package.json` — added `lint:tests` script
- `Makefile` — added `lint-tests` target

## Errors / Corrections

- First fixture draft used `export {}` to scope modules → biome `noExportsInTest` ERROR → switched to `// @ts-nocheck`.
- First fixture draft used typed `declare const test: {...}` → TS2339 on `.skip`/`.todo` + TS2451 redeclaration → simplified to `declare const test: any` then dropped declaration entirely with `@ts-nocheck`.

## Ready for Next Run

- task_07 wires `lint-tests` into `.github/workflows/ci.yml` as a matrix entry.
- `scanFile` and `scanDir` are exported and stable — task_07 can depend on them without changes.
