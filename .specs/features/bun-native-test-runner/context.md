# Bun Native Test Runner Migration Context

**Gathered:** 2026-08-22
**Spec:** `.specs/features/bun-native-test-runner/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Maintain Node 24/Vitest as a trustworthy reference while repairing and
validating Bun 1.4/Bun Test in cohorts. Produce attributable A/B/C measurements,
exercise Bun Test in CI shadow mode, and preserve a reversible cutover. Keep
Playwright as a separate E2E concern.

---

## Implementation Decisions

### Parallel paths

- A is Vitest on explicit Node 24.
- B is Vitest on explicit Bun 1.4.0.
- C is Bun Test on Bun 1.4.0.
- Runtime provenance is measured, not inferred from the command name.
- Existing Bun twins are preserved and repaired by cohort.

### Comparison integrity

- Benchmarks run sequentially on one machine.
- Repetitions interleave arm order.
- Unequal test inventories invalidate performance comparison.
- Timestamped JSON and Markdown evidence lives under `docs/benchmarks/bun-test/`.

### CI and cutover

- Node 24/Vitest remains blocking during shadow mode.
- Bun Test is initially non-blocking and retains evidence.
- Ten consecutive matching green runs make Bun Test eligible for explicit cutover.
- A failure or inventory mismatch resets the count.
- Vitest remains until no Vitest-only file exists.

### Playwright

- Playwright remains the E2E runner on its supported Node runtime.
- The application under E2E continues to run through Bun.
- Forced-Bun Playwright is optional, non-blocking, and excluded from Bun Test cutover evidence.
- Firefox and WebKit expansion is deferred to a separate feature.

### Agent's Discretion

- Exact cohort boundaries, provided dependencies move from pure tests toward DOM,
  mocks/timers, integration, and infrastructure tests.
- Internal benchmark module boundaries, provided the existing benchmark helpers are
  reused before new abstractions are introduced.
- CI artifact format, provided failures and provenance remain inspectable.

### Declined / Undiscussed Gray Areas → Assumptions

- Coverage tooling remains unchanged because the Blog has no current coverage gate.
- The ten-run threshold is an initial operational rule, not a statistical guarantee.
- Existing 124 Bun twins are repaired rather than deleted and regenerated.

---

## Specific References

- Existing benchmark methodology: `docs/benchmarks/bun-1-4/README.md`.
- Existing runtime findings: `docs/benchmarks/node-vs-bun/README.md`.
- Project decision AD-001 in `.specs/STATE.md`.

---

## Deferred Ideas

- Playwright Firefox and WebKit projects.
- Bun.WebView smoke tests.
- Removing Vitest before the incompatible inventory reaches zero.
