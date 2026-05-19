# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

CI gate integration: extend quality matrix to `e2e` + `lint-tests`, add Chromium cache, inject secrets, upload artifacts, document in cicd.md.

## Important Decisions

- `lint-tests` Makefile target already exists (task_06 added it). Only `test-e2e` is new.
- No `yaml` or `js-yaml` dep added — ci-workflow tests use `readFileSync` + string/regex matching (same pattern as makefile.test.ts).
- `test:e2e` script added to package.json (`playwright test`); Makefile `test-e2e` target invokes `bun run test:e2e`.
- e2e matrix entry needs a build step (`bun run build`) before playwright runs, since `playwright.config.ts` uses `bun run preview` as webServer (requires build artifact).
- Chromium cache key: `playwright-${{ runner.os }}-${{ hashFiles('bun.lock') }}`, path `~/.cache/ms-playwright`.
- E2E secrets injected via `env:` on the run step using GHA ternary: `${{ matrix.check == 'e2e' && secrets.E2E_ADMIN_EMAIL || '' }}`.
- Artifact upload uses `if: always() && matrix.check == 'e2e'`, retention 7 days.

## Files / Surfaces

- `.github/workflows/ci.yml` — matrix extended, cache + build + env + artifact steps added
- `Makefile` — `test-e2e` target + `.PHONY` updated
- `package.json` — `test:e2e` script added
- `.agents/rules/cicd.md` — E2E secrets table + subsection added
- `app/tests/ci-workflow.test.ts` — new Vitest file for ci.yml assertions
- `app/tests/makefile.test.ts` — new tests for test-e2e/.PHONY

## Errors / Corrections

## Ready for Next Run
