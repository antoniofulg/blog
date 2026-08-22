# Bun Test migration playbook

This migration keeps Node 24/Vitest as the blocking reference while Bun Test
runs in CI shadow mode. It does not remap `test` yet and it does not remove
Vitest.

## Commands

Run commands from the repository root with Bun 1.4.0 and Node 24 available:

```sh
bun run test                         # blocking Node 24/Vitest reference
bun run test:vitest:node             # A: explicit Node 24 + Vitest 4.1.5
bun run test:vitest:bun              # B: Bun 1.4.0 + Vitest 4.1.5
bun run test:bun                     # C: Bun 1.4.0 + Bun Test
bun run test:parity                  # reference/candidate inventory gate
bun run bench:tests                  # one sequential A/B/C repetition
bun run bench:tests --only=A,C --repetitions=3
```

`test:vitest:bun` excludes the Node-specific runtime probe. The probe and the
candidate preflight print executable and version provenance. A mismatched
runtime fails before tests run.

## A/B/C measurements

The arms change one variable at a time:

| Arm | Runtime | Runner | Tree |
| --- | --- | --- | --- |
| A | Node 24 | Vitest 4.1.5 | `app/tests` |
| B | Bun 1.4.0 | Vitest 4.1.5 | `app/tests` |
| C | Bun 1.4.0 | Bun Test 1.4.0 | `app/tests-bun` |

The harness runs arms sequentially on one machine. Repetitions reverse arm
order, so ambient load does not always favor one arm. Each sample records
duration, peak RSS, load, executable, runtime, runner, versions, commit,
timestamp, outcome counts, and failure excerpts. Dependency installation and
Playwright browser time are outside this comparison.

Reports are unique timestamped JSON and Markdown files in
`docs/benchmarks/bun-test/`. JSON retains raw samples. Markdown reports per-arm
medians and deltas only when the comparison is valid.

A comparison is invalid when parity differs, provenance is missing or wrong,
an arm exits non-zero, times out, or produces no summary. Invalid reports list
reasons and make no performance claim. Shared-runner timing is compatibility
evidence, not a performance winner claim.

## Shadow eligibility

The CI `bun-test-shadow` job runs parity and `test:bun` with Bun 1.4.0. Its
failure is non-blocking, but JSON and logs are uploaded for seven days. The
`quality` matrix `test` entry remains blocking and installs Node 24 before the
Vitest reference.

Bun Test becomes eligible for an explicit cutover decision only after a suffix
of ten consecutive green, valid, matching-inventory shadow results. Evaluate
results by timestamp, not filesystem order. A failed test, timeout, noisy run,
inventory mismatch, malformed result, duplicate timestamp, or mixed commit
resets eligibility at that point. Noise from PGLite contention never counts.

## Cutover and rollback

Cutover is a deliberate change, not an automatic CI action. After the ten-run
threshold and review:

1. Change `test` to delegate to `test:bun`.
2. Keep `test:vitest:node` as the explicit blocking fallback.
3. Keep parity and the twin tree in CI.
4. If Bun Test regresses, map `test` back to `test:vitest:node`, retain all
   migrated tests and reports, and investigate the recorded evidence.

Vitest can be removed only when the Vitest-only inventory is empty and a
separate removal decision is recorded. This checkout remains before cutover:
`test` still points to the Node 24 reference.

## Playwright boundary

Playwright remains the primary E2E suite, now forced through Bun by
`test:e2e:bun`. Its configured web server starts the Blog through
`bun run scripts/e2e-server.ts`. The project keeps one worker, Chromium,
fixtures, traces, reporters, retries, and screenshots. `test:e2e:node` remains
the explicit fallback. The retired Bun.WebView experiment is historical
evidence only and is not part of the Bun Test cutover. Firefox and WebKit remain
deferred.
