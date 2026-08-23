# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test CI artifact producers by parsing their emitted JSON with the production evaluator.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: bun-native-test-runner
- evidence: validation.md:Ranked Gap 1 (ci)
- last seen: 2026-08-22T09:15:51Z

### L-002 - Test each comparison invalidation reason in isolation so another invalid reason cannot mask it.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `test-bench` · harmful: 0
- features: bun-native-test-runner
- evidence: validation.md:M2 (test-bench)
- last seen: 2026-08-22T09:15:51Z

### L-003 - Require exact twin test and assertion inventories unless a difference has an explicit disposition.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: bun-native-test-runner
- evidence: validation.md:Cohort-1 (tests)
- last seen: 2026-08-22T09:15:51Z

### L-004 - A focused retry does not clear an E2E gate; require a subsequent full-suite pass.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: bun-native-test-runner
- evidence: validation.md:Gate Check E2E (e2e)
- last seen: 2026-08-22T09:15:51Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
