# Bun Test migration — historical evidence

Status: historical signal superseded again on 2026-08-25 by AD-006. Bun Test
is now the permanent unit/component/integration runner after a controlled
runner-first revalidation. The earlier retirement followed two local
full-suite signals that were roughly twice as slow (60.96 vs 119.71 s and 59.56 vs
127.88 s). Inventory/skip differences and shared-runner conditions made both
uncontrolled rather than valid performance benchmarks; memory evidence was
inconclusive, and the evidence did not justify maintaining the candidate at
that time. The later controlled matrix is in
[`bun-test-revalidation`](../bun-test-revalidation/README.md).

This directory remains as the evidence pointer for the first, invalid
experiment. The full measurements, historical tables, raw-report links, and limitations are in
the [consolidated testing-runtime evidence pack](../testing-runtimes/2026-08-22-summary.md).
The completed migration requirements and independent verification remain in the
[native-runner validation report](../../../.specs/features/bun-native-test-runner/validation.md)
and [migration follow-up validation](../../../.specs/features/bun-migration-follow-up/validation.md).

Historical A/B/C work compared Node 24 + Vitest, Bun 1.4 + Vitest, and Bun 1.4
+ Bun Test. Preserve its numbers and reports for traceability; do not treat
them as current performance guidance or a pending runner decision.
