# Bun Test migration — historical evidence

Status: superseded on 2026-08-24. Bun 1.4 + Vitest is the permanent
unit/component/integration runner. Bun Test was retired after two local
full-suite signals were roughly twice as slow (60.96 vs 119.71 s and 59.56 vs
127.88 s). Inventory/skip differences and shared-runner conditions made both
uncontrolled rather than valid performance benchmarks; memory evidence was
inconclusive, and the evidence did not justify maintaining the candidate. No
Bun Test command, parity gate, shadow run, or cutover is operational.

This directory remains as the evidence pointer for the retired experiment. The
full measurements, historical tables, raw-report links, and limitations are in
the [consolidated testing-runtime evidence pack](../testing-runtimes/2026-08-22-summary.md).
The completed migration requirements and independent verification remain in the
[native-runner validation report](../../../.specs/features/bun-native-test-runner/validation.md)
and [migration follow-up validation](../../../.specs/features/bun-migration-follow-up/validation.md).

Historical A/B/C work compared Node 24 + Vitest, Bun 1.4 + Vitest, and Bun 1.4
+ Bun Test. Preserve its numbers and reports for traceability; do not treat
them as current performance guidance or a pending runner decision.
