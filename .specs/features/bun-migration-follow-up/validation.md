# Bun Migration Follow-up Validation

**Date**: 2026-08-23
**Spec**: `.specs/features/bun-migration-follow-up/spec.md`
**Diff range**: `07598d872adebd75d48a050bb731f61ef6922d05..c5ceae5638d5c1c67c1436a4b2ece271ba2c11a9`
**Verifier**: independent Sol/medium sub-agent (author != verifier), final iteration
**Verdict**: PASS
<!-- verdict: PASS -->

---

## Task Completion

| Tasks | Status | Notes |
| --- | --- | --- |
| T1-T10 | Done / Verified | `.specs/features/bun-migration-follow-up/tasks.md:9` is Done; requirement traceability is Verified at `spec.md:113-116`. Runtime, benchmark, browser, evidence, bilingual-post, and current-state artifacts remain verified. |

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion/evidence | Result |
| --- | --- | --- | --- |
| BMF-01.1 worker profiles | Run Bun 1.4 + Vitest with `1`, `2`, `4`, and omitted `--maxWorkers`. | `app/tests/bench-vitest-workers.test.ts:63` asserts IDs `["1","2","4","auto"]`; `:70` asserts auto omits `--maxWorkers`. | PASS |
| BMF-01.2 sampling and fields | One discarded warmup and five measured samples per profile, with duration, process-group RSS, load, command, versions, and outcomes persisted. | `app/tests/bench-vitest-workers.test.ts:82` asserts 12 ordered invocations, five samples/profile, one warmup, and excluded-warmup aggregate at `:94-119`; `app/tests/bench-runner.test.ts:37-58` verifies descendant process-group RSS by same-topology idle/heavy delta; persisted JSON `docs/benchmarks/vitest-workers/workers-2026-08-23T07-55-28-315Z.json:1` contains 1 warmup + 5 samples for all four profiles. | PASS |
| BMF-01.3 validity and winner rules | Invalid profiles are excluded individually; memory comparison needs at least two equivalent valid profiles; noisy timing suppresses only overall winner while retaining memory winner when valid. | `app/tests/bench-vitest-workers.test.ts:140` asserts one failed profile is excluded while other profiles remain valid and winner selection continues at `:163-175`; `:240-264` asserts load-gate timeout invalidation; `:267-290` asserts ambient load suppresses overall winner. Persisted JSON records `validMemoryComparison: true`, `memoryWinner: "2"`, `validTimingComparison: false`, `winner: null`. | PASS |
| BMF-01.4 local command | Map `test:local` to the lowest-practical-memory reliable profile and leave `test` unchanged. | `app/tests/test-scripts.test.ts:31-35` asserts unchanged `test` and serialized `test:local`; `docs/benchmarks/testing-runtimes/2026-08-22-summary.md:233-242` records the 2.0 MiB tie and reliability decision. | PASS |
| BMF-02.1 leaf vs runner skips | Distinguish skipped leaf tests from runner-only skipped suites/hooks. | `app/tests/test-bench-runner.test.ts:156-165` asserts raw `26` and normalized leaf `21`; implementation is `app/lib/test-bench/runner.server.ts:130-151`. Sensor mutation returning raw skips as leaf skips failed both twins. | PASS |
| BMF-02.2 restore lost leaves if present | Restore execution only if the five extra skips are unexecuted leaves; do not delete or weaken tests. | Conditional branch resolved false: `docs/benchmarks/bun-test/README.md:99-103` identifies five synthetic `(unnamed)` hooks. Fresh parity and runner results match 2,376 passed and 52 normalized leaf skips. Diff integrity found no deleted test files or new skip mechanism. | PASS |
| BMF-02.3 preserve raw count | For runner-only skips, compare leaf outcomes and retain raw runner count. | `app/tests/test-bench-runner.test.ts:164-165` asserts raw `26` and normalized `21`. Fresh Bun Test preserved 57 raw skips while Vitest reported 52 leaf skips. | PASS |
| BMF-02.4 static parity prerequisite | Static source/assertion parity remains a separate prerequisite. | Fresh `bun run test:parity` exited 0 with `Parity passed: reference and candidate inventories match.` `app/tests/test-bench-runner.test.ts:246-260` separately invalidates a failed inventory prerequisite. | PASS |
| BMF-03.1 runtime contract | Node 24 and Bun 1.4 use the same config, Chromium, one worker, zero retries, and Bun application server. | `app/tests/bench-e2e-runtimes.test.ts:70-100` asserts both complete forced commands, including Bun's `bunx --bun playwright test`; `app/tests/ci-bun-test-shadow.test.ts:78-80` asserts the Bun server boundary. | PASS |
| BMF-03.2 E2E sampling | One excluded warmup and five interleaved measured samples per arm with required metadata. | `app/tests/bench-e2e-runtimes.test.ts:162-209` asserts runtime validation, interleaving, warmup exclusion, aggregation, load, version, browser, and cleanup. Persisted JSON `docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.json:1` contains one warmup + five samples for each arm. | PASS |
| BMF-03.3 invalid samples/inventory | Failed, skipped, flaky, unexpected, timed-out, orphaned, or changed-inventory samples invalidate comparison and suppress winners. | `app/tests/bench-e2e-runtimes.test.ts:117-159` creates individually valid zero-failure arms with inventories `10` and `9`, then asserts both comparisons false, both winners null, and exact reason. Removing the cross-arm check failed both twins at line 153. `:238-266` covers failure/skip/orphan invalidation. | PASS |
| BMF-03.4 browser projects | Define Chromium, Firefox, and WebKit with authenticated setup dependency and one worker. | `playwright.config.ts:3-7,18-46`; `app/tests/ci-bun-test-shadow.test.ts:66-75` asserts all names, devices, worker count, and all three setup dependencies. Removing Firefox's dependency failed both twins. | PASS |
| BMF-03.5 local browser results | Each project completes the full applicable suite with zero unexpected failures and one worker. | Fresh canonical Chromium gate passed 49/49 using one worker. Persisted `docs/benchmarks/e2e-browsers/2026-08-23-{chromium,firefox,webkit}.json:1-21` records each project passed 49 expected, zero skipped/unexpected/flaky, one worker. | PASS |
| BMF-04.1 documentation audit | Completed specs/current state are correct; historical evidence is preserved/labeled; obsolete executable guidance is removed/labeled. | Historical evidence is labeled at `docs/benchmarks/testing-runtimes/2026-08-22-summary.md:227-242`. `.specs/STATE.md:33-38` now states T1-T10 implementation complete, Bun Test 0/10, the operational collection next step, and the atemporal repository state without claiming a transient porcelain snapshot. Fresh `acb9348..72555e3` review shows only this Markdown correction. | PASS |
| BMF-04.2 cutover eligibility | Require ten valid consecutive distinct commits with parity and equivalent leaf outcomes. | `app/tests/test-bench-shadow.test.ts:71-84` asserts 9 false/10 true; `:194-210` asserts duplicate commits reject and outcome mismatch resets. `docs/benchmarks/bun-test/README.md:106-110` records real eligibility 0/10. | PASS |
| BMF-04.3 retain fallbacks before ten | With fewer than ten valid runs, retain Vitest, Node fallbacks, and canonical `app/tests`. | `app/tests/test-scripts.test.ts:32,38-60,87-95` asserts Vitest default, Node fallbacks, both reference extensions, and Bun/Node Playwright routes. `docs/benchmarks/bun-test/README.md:112-129` inventories retained surfaces and removal gate. | PASS |
| BMF-04.4 bilingual post | Publish EN/PT-BR twins with matching claims, raw links, limits, warmup method, and final decision. | Matching frontmatter at `app/content/posts/en/migrating-tests-to-bun-1-4.mdx:1-10` and `app/content/posts/pt-br/migrating-tests-to-bun-1-4.mdx:1-10`; methodology, limitations, evidence links, and decision span `:59-107` in both. Fresh content audit passed 0 blocker/0 major/0 minor. | PASS |

**Spec-anchored status**: 17/17 ACs have current, discriminating evidence.

## Edge Cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| Host load above bound retains diagnostics and publishes no overall winner. | `app/tests/bench-vitest-workers.test.ts:267-290`; persisted worker JSON records valid memory, invalid timing, and null overall winner. | PASS |
| Firefox/WebKit incompatibility is fixed without weakening user-visible assertions. | `tests/e2e/admin-share.spec.ts:18-43,91-108`; committed browser JSON records all three projects 49/49. | PASS |
| Branch checked out by a worktree is preserved and recorded. | `docs/benchmarks/testing-runtimes/2026-08-22-summary.md:301-310`. | PASS |
| Historical stack documents stay labeled evidence. | `docs/benchmarks/testing-runtimes/2026-08-22-summary.md:227-231`. | PASS |

## Gate Check

- **Final hardening delta**: `72555e3..c5ceae5` changes only six twin test files plus `spec.md`/`tasks.md`; no production path changed. `git diff --check` exited 0.
- **Final focused memory twins**: Vitest `app/tests/bench-runner.test.ts` exited 0, 8/8 in 15.52s. Bun twin exited 0, 8/8, 18 `expect()` calls in 15.50s.
- **Final destructive-suite stress**: Vitest indexer+sync with `--maxWorkers=2` passed 2 files/10 tests in three consecutive runs. Bun twins passed 2 files/10 tests once.
- **Final static checks**: Biome checked all six changed tests with no fixes; `tsc --noEmit` exited 0; parity exited 0.
- **Iteration 3 Markdown delta**: `git diff --check acb9348..72555e3` exited 0. The commit changes only `.specs/STATE.md` (3 additions, 3 deletions).
- **Iteration 3 focused reverification**: Vitest twin exited 0 with 7/7; Bun Test twin exited 0 with 7/7 and 43 `expect()` calls; parity exited 0.
- **Focused Vitest twin**: `bun run test:vitest:bun -- app/tests/bench-e2e-runtimes.test.ts` exited 0; 1 file, 7 passed, 0 failed.
- **Focused Bun Test twin**: direct runtime guard plus `bun test --timeout 60000 --isolate app/tests-bun/bench-e2e-runtimes.test.ts` exited 0; 1 file, 7 passed, 0 failed, 43 `expect()` calls.
- **Static parity**: `bun run test:parity` exited 0; reference and candidate inventories match (141/141 reported by the project evidence and both full gates ran 141 files).
- **Final build gate at `c5ceae5`**: fresh evidence supplied by the orchestrator for `make lint && make check && make build-js && make test && make lint-tests`: exit 0; Vitest 141 files, 2,376 passed, 52 skipped, 0 failed.
- **Final full Bun command at `c5ceae5`**: fresh orchestrator evidence for `bun run test:bun`: exit 0; 141 files, 2,376 passed, 57 raw skipped, 0 failed.
- **Final `test:local` at `c5ceae5`**: fresh orchestrator evidence: 141 files, 2,376 passed, 52 skipped, 0 failed.
- **Final Playwright Chromium at `c5ceae5`**: fresh orchestrator evidence: 49/49 passed, one worker.
- **Final content audit at `c5ceae5`**: fresh orchestrator evidence: 0 blocker, 0 major, 0 minor; transient audit effects removed.
- **TLC structure**: `validate_spec.py` exited 0 with 0 errors/0 warnings. `validate_tasks.py` exited 0 with 0 errors and one existing T5 multi-file granularity warning.
- **Build warnings**: existing route-file/code-split/chunk/eval warnings; no build failure. Bun Test emitted existing dialog accessibility warnings; no test failure.

## Test Integrity and Counts

- Base `07598d8` fresh Vitest run: 139 files, 2,350 passed, 55 skipped, 2,405 total.
- HEAD fresh Vitest run: 141 files, 2,376 passed, 52 skipped, 2,428 total.
- Delta: +2 files and +23 tests; no count decrease.
- Fresh parity passed. Twin additions remain structurally matched.
- Diff review found no deleted test files, no `test.only`, and no new skip used to manipulate counts.
- Bun Test's five extra raw skips are synthetic runner hooks; normalized leaf result is 2,376 passed / 52 skipped, matching Vitest.

## Discrimination Sensor

Final scratch worktree: `/tmp/bmf-final-sensor.ivbWhp` at `c5ceae5`, removed after testing. Real-tree porcelain was only `?? .specs/features/bun-migration-follow-up/validation.md` before and after cleanup. Earlier scratch sensor results remain listed because later commits did not touch their implementation or assertions.

| Mutation | File:line | Exact outcome | Result |
| --- | --- | --- | --- |
| Replace the heavy descendant with the exact idle descendant workload, preserving process topology. | `app/tests/bench-runner.test.ts:48-58` | Focused Vitest exited 1: 1 failed/7 skipped; both RSS values were exactly `21,315,584`, killing the `toBeGreaterThan` assertion at line 57. | KILLED |
| Remove advisory-lock acquisition from both concurrent Vitest destructive suites while retaining their one-connection clients. | `app/tests/indexer-integ.test.ts:32-36`; `app/tests/sync-integ.test.ts:34-38` | First bounded `--maxWorkers=2` run exited non-zero: indexer expected 3 synchronized rows but received 2 at `app/tests/indexer-integ.test.ts:122`; 1 failed/9 passed. | KILLED |
| Remove the complete cross-arm Playwright inventory comparison block. | `scripts/bench-e2e-runtimes.ts:491-499` | Vitest: 1 failed/6 passed at `app/tests/bench-e2e-runtimes.test.ts:153`, expected false but received true. Bun twin: 1 failed/6 passed at the same assertion. | KILLED |
| Return raw Bun skips as leaf skips (`leafTestsSkipped: testsSkipped`). | `app/lib/test-bench/runner.server.ts:151` | Vitest: 1 failed/17 passed, expected 21 but received 26 at `app/tests/test-bench-runner.test.ts:165`. Bun twin failed identically. | KILLED |
| Remove Firefox authenticated setup dependency. | `playwright.config.ts:37` | Vitest: 1 failed/11 passed at `app/tests/ci-bun-test-shadow.test.ts:73`. Bun twin failed identically. | KILLED |

**Sensor depth**: five targeted behavior/config mutations across the final verification chain.
**Sensor result**: 5/5 killed, 0 survived — PASS.

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum/surgical implementation and existing helpers reused | PASS |
| No unrelated dependency or feature | PASS |
| Spec-anchored outcome assertions and payload/conjunction checks | PASS |
| Project testing/CI/content rules followed | PASS |
| Test integrity and count non-regression | PASS |
| Current documentation internally accurate | PASS — `.specs/STATE.md:33-38` is current and avoids transient uncommitted-file claims. |
| Memory probe root cause | PASS — idle/heavy commands keep the same descendant topology and require a >32 MiB delta at `app/tests/bench-runner.test.ts:37-58`, replacing a host-sensitive absolute RSS floor. |
| Destructive-suite root cause | PASS — indexer and sync use the same lock key, a dedicated `postgres` client with `max: 1`, lock/unlock through that client, guarded unlock, and nested `finally` ensuring `sql.end()` at `app/tests/indexer-integ.test.ts:32-66` and `app/tests/sync-integ.test.ts:34-66`; twins match. |
| Production behavior unchanged | PASS — `72555e3..c5ceae5` contains only tests and spec/task status Markdown. |

Guidelines checked: `AGENTS.md`, `.agents/rules/testing.md`,
`.agents/rules/cicd.md`, `.agents/rules/audit.md`,
`.agents/rules/git-workflow.md`, and `CONTENT.md`.

## Ranked Gaps

None.

## Summary

**Overall**: PASS — ready for verified completion.

- Runtime, parity, build, full Bun Test, Chromium, content, and structural gates pass.
- The prior BMF-03.3 regression gap is fixed and empirically discriminating in both twins.
- BMF-04.1 now passes: the handoff records implementation completion, 0/10 operational follow-up, and an atemporal repository-state statement.
- 17/17 ACs pass. No surviving mutant, spec-precision gap, deviation, or failed AC remains, so no lesson is recorded.
- Final CI-stability hardening is root-cause based: topology-relative RSS measurement and session-scoped serialization of destructive integration suites. Both new mutants were killed.
