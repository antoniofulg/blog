---
provider: manual
pr:
round: 8
round_created_at: 2026-05-20T04:53:28Z
status: resolved
file: docs/_reports/app-audit-2026-05-20.md
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Round 7 fixes 001 / 003 / 004 unverified — preflight aborts before exercising those code paths

## Review Comment

Round 7 landed 4 fixes in commit `467ce15`:

- 001: Lighthouse import (`@lhci/cli` `module.exports = LighthouseRunner` directly, not `.LighthouseRunner`)
- 002: baseUrl default 3000→4173 + preflight reachability check
- 003: axe short-circuit when sweep returns sweep-error
- 004: parameterized routes (`:slug`) expansion via `sampleSlug` field

The latest `docs/_reports/app-audit-2026-05-20.md` proves issue 002 fix works (preflight aborted with clear message). But the audit aborted BEFORE exercising any of the route-iteration code paths — meaning fixes 001, 003, 004 are unverified by execution. The previous run that produced 60 sweep-errors is no longer reproducible; we cannot tell whether:

- Lighthouse import resolution actually works against a live preview server.
- The axe short-circuit correctly skips analyzeA11y when sweepRoute returns sweep-error.
- `:slug` route expansion produces real URLs instead of literal `/:slug` patterns.

The Vitest unit tests landed with round 7's fix should cover the static cases (mocked LighthouseRunner constructor, mocked sweep returning sweep-error, normalized `RouteEntry.sampleSlug`), but unit-test coverage does not exercise the integration path. The "first-real-run" gate that round 7 retrospect identified as needed for catching runtime bugs is the missing verification step — and the current run did not provide that signal because preflight ran first.

This is a process/verification gap, not a code defect per se. The risk: merging Phase 4 to main with three round-7 fixes that may not actually work in the integrated context.

**Suggested fix:** complete the round 7 verification cycle by running `make audit` against a live preview server BEFORE declaring Phase 4 done. Procedure:

```bash
# Terminal 1: start preview server
bun run build
bun preview  # serves on :4173

# Terminal 2: run audit
make audit
```

Expected outcomes if all round 7 fixes are correct:

1. Preflight reachability check passes (no `preflight` sweep-error).
2. Each of the 12 categories produces findings reflecting real site state (likely some `missing-meta`, possibly some `a11y-violation`, possibly some `seo-score-drop` if Lighthouse runs).
3. `sweep-error` findings (if any) reference real route paths, not `:slug` placeholders.
4. NO duplicate `sweep-error` findings per route (axe short-circuit working).
5. NO Lighthouse import errors (round 7 issue 001 fix working).

If any of these expectations fail, the corresponding round 7 fix has a regression and a new round 8 issue should track it.

This task's "fix" is operational: run the audit against a live server and either confirm clean execution or open follow-up issues. No code change required IF the round 7 fixes all work. If something fails, the round 7 fix in question is reopened (status: pending → invalid; new round 9 issue tracks the regression).

## Triage

- Decision: `valid`
- Notes: This is an operational/process verification task, not a code defect. The fix requires running `make audit` against a live preview server. Round 8 code fixes (issues 001–003) changed the preflight behavior, which means a live run now produces different output (preflight-error blocker with exit code 1 if server unreachable; route-inspection findings if server reachable). Unit tests for all round 7 fixes pass (app-audit-checks.test.ts: axe short-circuit, resolveRoutePath, :slug expansion all covered). The integration path remains unverified until a live run completes. Documenting the required procedure: `bun run build && bun preview` (terminal 1), then `make audit` (terminal 2). No new code regression issues were found — all round 7 unit tests pass in this round.
