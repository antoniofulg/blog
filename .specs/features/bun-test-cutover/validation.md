# Bun Test Cutover Validation

**Result**: PASS
**Date**: 2026-08-25
**Spec**: `.specs/features/bun-test-cutover/spec.md`
**Diff range**: `010f4a1^..86190a7`
**Verified HEAD**: `86190a79b973d4c6818919294aa2c4e1efc7b381`
**Verifier**: independent sub-agent (author != verifier)

## Task Completion

| Task | Result | Evidence |
| --- | --- | --- |
| T1 | PASS | Git inventory preserves all 113 candidate product files and adds exactly 20 infrastructure files; `app/tests/README.md:3-4` records the 133-file contract. |
| T2 | PASS | Retired parity/revalidation modules and scripts are absent; `app/tests/test-scripts.test.ts:46-53` asserts comparison routes are absent. |
| T3 | PASS | `package.json:15-17` makes native Bun Test canonical; fresh suite ran 2,256 pass, 101 skip, 0 fail across 133 files. |
| T4 | PASS | `.github/workflows/ci.yml:15-35` retains the blocking quality matrix with Bun 1.4 and `make`; `Makefile:86-109` delegates unit and E2E gates. |
| T5 | PASS | AD-006 and benchmark amendment are recorded at `.specs/STATE.md:46-50` and `docs/benchmarks/bun-test-revalidation/README.md:8-17,21-38`. |
| T6 | PASS | Full fresh local gate and independent sensor passed. The unchecked source checklist was not edited because verifier ownership is limited to this report. |

## Spec-Anchored Requirement Check

| Requirement | Spec-defined outcome | Evidence and assertion/contract | Result |
| --- | --- | --- | --- |
| BTC-01 | Default/local unit, component, integration, and infrastructure tests run native Bun Test 1.4.0 with two isolated workers against `app/tests`; 133 files finish with zero failures. | `package.json:15-17` defines `test -> test:bun`, exact Bun/runtime provenance, and `bun test --parallel=2 --isolate`; `bunfig.toml:2-3` roots discovery at `app/tests`; `app/tests/test-scripts.test.ts:29-43` asserts the aliases, flags, and root; fresh command reported `bun test v1.4.0`, `2x PARALLEL`, 2,256 pass, 101 skip, 0 fail in 133 files. | PASS |
| BTC-02 | Preserve every one of the 113 validated product files and all 20 active infrastructure files; delete only runner-only coverage. | Independent git-set comparison between `010f4a1:app/tests-bun` and `HEAD:app/tests` found 113/113 product basenames preserved plus exactly 20 additions; `app/tests/README.md:3-4` states 113 + 20 = 133. All 133 test files import `bun:test`. | PASS |
| BTC-03 | Remove Vitest/jsdom dependencies, config, executable routes, duplicate live tree, and product imports; runtime provenance rejects non-native runners. | `package.json` and `bun.lock` contain no dependency entry for `vitest`, `@vitest/*`, or `jsdom`; `vitest.config.ts` and retired comparison scripts are absent; no tracked file exists below `app/tests-bun`; `app/tests/test-scripts.test.ts:46-53` asserts route absence; `scripts/check-test-runtime.ts:44-50` accepts only Bun, exact semver, and `bun:test`; `app/tests/test-runtime.test.ts:44-65` asserts wrong versions/runtime/runner throw. | PASS |
| BTC-04 | DOM tests use selective HappyDOM while pure/server tests avoid a global DOM preload. | `app/tests/README.md:13-16` requires explicit `./happydom` imports; `app/tests/happydom.ts:3-20,53-60` registers HappyDOM, restores Bun-native fetch classes, and cleans after each test; only DOM/component files import the helper; `app/tests/dom-setup.test.ts:25-35` asserts native headers and DOM cleanup. | PASS |
| BTC-05 | Chromium Playwright stays the blocking Bun-driven E2E gate; Firefox/WebKit and Node fallback remain; WebView stays a five-route local diagnostic outside CI. | `package.json:29-32` retains Bun Chromium, Node Chromium fallback, and all-browser routes; `app/tests/test-scripts.test.ts:62-71` asserts exact commands and absence of WebView routes; `playwright.config.ts:6,24,32,40` keeps one worker and Chromium/Firefox/WebKit; `app/tests/ci-runtime-contract.test.ts:28-44` asserts projects, Bun server, worker count, and no WebView CI route; fresh Chromium run passed 49/49. | PASS |
| BTC-06 | Living documentation names Bun Test canonical, preserves historical evidence, and says the five-route comparison is route-equivalent but not lifecycle/capability-equivalent. | `.specs/STATE.md:46-50` records AD-006 and supersession; `.agents/rules/testing.md:19-27` records isolated-2 metrics and 113 + 20 inventory; `docs/benchmarks/bun-test-revalidation/README.md:21-38` preserves Playwright's 49-outcome boundary, exact five-route subset, and warm persistent WebView versus measured Playwright lifecycle warning. | PASS |

**Spec-anchored status**: 6/6 requirements match precise outcomes. No spec-precision gap.

## Inventory and Removed Leaves

- Current tracked inventory: 133 test files.
- Product preservation: 113/113 candidate basenames preserved.
- Active infrastructure: exactly 20 files, comprising 15 `bench-*` tests and five browser/CI/runtime/script contract files.
- Candidate result before canonical cleanup: 2,263 pass, 101 raw skips.
- Canonical result: 2,256 pass, 101 raw skips.
- Delta: seven runner-only leaves, zero product files and zero active infrastructure files.

The seven-leaf decrease is justified. Comparing the 20 infrastructure files at `87c50ce:app/tests-bun` with HEAD shows the CI/runtime/script contract group fell from 23 leaves to 16. Removed outcomes exercised the retired Node/Vitest control, parity and alternate worker profiles, rollback routes, `vitest.config.ts`, and Bun-candidate paths. Canonical assertions replaced them with exact Bun 1.4, native-runner, isolated-2, root-path, and route-absence contracts at `app/tests/test-runtime.test.ts:15-65` and `app/tests/test-scripts.test.ts:27-71`. No product assertion was lost.

## Full Gate

Executed sequentially to limit memory pressure:

| Command | Fresh result |
| --- | --- |
| `bun install --frozen-lockfile` | PASS; Bun 1.4.0; 989 installs across 1,129 packages; no changes. |
| `bun run lint` | PASS; 263 files checked; no fixes. |
| `bunx tsc --noEmit` | PASS. |
| `bun run test` | PASS; 2,256 pass, 101 skip, 0 fail, 181,097 assertions, 133 files. |
| `bun run build` | PASS. Existing route/code-split/chunk warnings did not fail the build. |
| `bun run lint:tests` | PASS. |
| `bun run test:e2e` | PASS; Chromium 49/49, one worker, zero skips/failures. |

### Skip audit

The 101 raw Bun Test skips are the existing environment-gated integration groups for unavailable local PostgreSQL/server/Docker resources. Representative guards are `app/tests/indexer-integ.test.ts:15-17`, `app/tests/drizzle-schema.test.ts:128-142`, and `app/tests/lang-blog-route.test.ts:170-175`. They are not quarantine skips and their count is unchanged from the approved canonical baseline. `lint:tests` passed, and Playwright had zero skipped tests.

## Discrimination Sensor

Sensor used a temporary worktree at HEAD. The real worktree was never mutated and no stash was used.

| Mutation | Target | Killing evidence | Result |
| --- | --- | --- | --- |
| Default alias changed from `bun run test:bun` to `bun run test:e2e:bun`. | `package.json:15` | `app/tests/test-scripts.test.ts:29` failed with exact expected/received alias. | KILLED |
| Canonical Bun test root changed from `app/tests` to `tests/e2e`. | `bunfig.toml:3` | Explicit focused run failed at `app/tests/test-scripts.test.ts:42`; ordinary discovery also found no matching unit file. | KILLED |
| Runtime parser changed to accept `vitest` as a runner. | `scripts/check-test-runtime.ts:49-50` | `app/tests/test-runtime.test.ts:62` failed because the non-native runner no longer threw. | KILLED |

**Sensor result**: 3/3 killed, 0 survived. Temporary worktree discarded. Real-tree porcelain before and after was identical: only pre-existing `?? docs/_reports/`. `docs/_reports/` existed before and after.

## Code Quality and Gaps

- Scope is test infrastructure, CI contracts, and living documentation. The only product-file edit is a jsdom-specific comment rewrite at `app/components/admin/analytics/range-selector.tsx:35-40`; product behavior is unchanged.
- Existing CI topology and Playwright configuration are preserved.
- Historical benchmark artifacts remain versioned.
- No unclaimed new behavior or speculative abstraction was added.
- Documented rules followed: `.agents/rules/testing.md` and `.agents/rules/cicd.md`.
- Non-blocking local residue: an empty, untracked-by-Git `app/tests-bun/` directory exists on disk, but it contains no files, is absent from the repository index, and is not a duplicate live tree.

**Ranked gaps**: none.

## Summary

**Overall**: PASS. Ready for the feature's validation commit.

All six requirements have file-and-assertion evidence. Fresh full gates passed. The 133-file inventory is exactly 113 product plus 20 infrastructure files. The seven-leaf reduction is confined to obsolete runner comparison contracts. The sensor killed all three mutations and preserved real worktree state.
