# Bun Test migration playbook

This migration uses Bun 1.4/Vitest as the blocking default while Bun Test runs
in CI shadow mode. Node 24/Vitest remains the explicit reference and rollback
route. Vitest is not being removed.

## Commands

Run commands from the repository root with Bun 1.4.0 and Node 24 available:

```sh
bun run test                         # blocking Bun 1.4/Vitest default
bun run test:vitest:node             # A: explicit Node 24 + Vitest 4.1.5
bun run test:vitest:bun              # B: Bun 1.4.0 + Vitest 4.1.5
bun run test:bun                     # C: Bun 1.4.0 + Bun Test
bun run test:parity                  # reference/candidate inventory gate
bun run bench:tests                  # one sequential A/B/C repetition
bun run bench:tests --only=A,C --repetitions=3
```

The Vitest runtime probe adapts its assertions to Node or Bun. It and the
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

The CI `bun-test-shadow` job runs parity, Bun 1.4 + Vitest (reference), and
Bun 1.4 + Bun Test (candidate). Its failure is non-blocking, but JSON and all
three logs are uploaded for seven days. The `quality` matrix `test` entry
remains blocking and runs Vitest through Bun.

Bun Test becomes eligible for an explicit cutover decision only after a suffix
of ten consecutive green, valid, matching-inventory shadow results from ten
distinct commits. Each record must contain equivalent reference/candidate
file, pass, fail, and normalized leaf-skip outcomes; raw runner skip counts
remain in the record for audit. Evaluate results by timestamp, not filesystem
order. A failed test, timeout, noisy run, inventory mismatch, outcome mismatch,
malformed result, duplicate timestamp, or duplicate commit resets eligibility.
Noise from PGLite contention never counts.

CI does not commit history. The uploaded `shadow-result.json` is imported
manually into the durable ledger at
`docs/benchmarks/bun-test/shadow-ledger.jsonl`, one JSON record per line, before
eligibility is evaluated. The ledger is a maintainer-owned evidence file, not a
CI output path, and imports must preserve the raw logs and commit SHA.

## Cutover and rollback

Cutover is a deliberate change, not an automatic CI action. After the ten-run
threshold and review:

1. Change `test` to delegate to `test:bun`.
2. Keep `test:vitest:node` as the explicit fallback.
3. Keep parity and the twin tree in CI.
4. If Bun Test regresses, map `test` back to `test:vitest:bun`, retain all
   migrated tests and reports, and investigate the recorded evidence.

Vitest can be removed only when the Vitest-only inventory is empty and a
separate removal decision is recorded. The runtime-only cutover from Node to
Bun + Vitest is complete; the runner cutover to Bun Test is not.

## Playwright boundary

Playwright remains the primary E2E suite, now forced through Bun by
`test:e2e:bun`. Its configured web server starts the Blog through
`bun run scripts/e2e-server.ts`. The project keeps one worker, Chromium,
fixtures, traces, reporters, retries, and screenshots. `test:e2e:node` remains
the explicit fallback. The retired Bun.WebView experiment is historical
evidence only and is not part of the Bun Test cutover. Firefox and WebKit remain
deferred.
