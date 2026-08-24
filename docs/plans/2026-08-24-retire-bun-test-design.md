# Retire the Bun Test candidate

## Decision

Keep Bun 1.4 as the application, tooling, Vitest, and Playwright runtime. Keep
Vitest as the permanent unit/component/integration runner. Retire Bun Test as
an executable candidate: two local full-suite signals were roughly twice as
slow, but inventory/skip differences made them unsuitable as controlled
performance benchmarks. Memory evidence was inconclusive, so the experiment
did not justify its maintenance cost.

## Remove

- The non-blocking `bun-test-shadow` CI job and its artifact producer.
- The mirrored `app/tests-bun/` tree.
- Bun Test, parity, cohort, shadow-ledger, and A/B/C benchmark scripts and
  implementation modules that have no remaining caller.
- Package scripts and `bunfig.toml` settings used only by Bun Test.
- Live tests and rules that require the retired candidate to exist.

## Preserve

- `test` and `test:local`, both running Vitest through Bun 1.4.
- Node 24 + Vitest and Node + Playwright rollback commands.
- Playwright through Bun, including Chromium CI and local Firefox/WebKit.
- Raw benchmark reports, completed specifications, validation reports, and the
  unpublished bilingual post as historical evidence.

Historical documents may describe the experiment in past tense. Current rules,
the evidence index, and the post must state the final decision and must not
advertise a future ten-shadow cutover.

## Verification

- No executable/config reference to `app/tests-bun`, `test:bun`,
  `test:parity`, cohorts, or `bun-test-shadow` remains.
- `bun install --frozen-lockfile`, lint, typecheck, build, Vitest, annotation
  lint, Playwright Chromium, content audit, Docker runner build/migration,
  commitlint, and branch-name checks pass locally.
- Test removal is limited to the duplicate Bun Test tree and tests for retired
  migration infrastructure. Canonical product-behavior tests in `app/tests/`
  remain unchanged.
