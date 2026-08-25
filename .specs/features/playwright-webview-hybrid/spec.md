# Playwright WebView Hybrid Specification

## Problem Statement

The prior WebView benchmark compared different harness and browser lifecycles,
so it could not isolate where Playwright spends time. We need an evidence-based
spike that keeps Playwright Test as the harness and swaps only the browser driver
for the same five-route workload.

## Goals

- [ ] Prove whether Bun.WebView can run inside a Bun-hosted Playwright Test worker without launching a Playwright browser.
- [ ] Compare matched cold lifecycle and warm action costs with reproducible time and memory evidence.
- [ ] Preserve the complete Playwright suite and all default/CI behavior.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Port all 49 E2E tests to WebView | WebView lacks required Locator, BrowserContext, trace, and storageState capabilities. |
| Change the canonical E2E runner or CI | This is a local bounded experiment. |
| Wrap Bun.WebView as a Playwright Page | The APIs own different browser objects and are not interoperable. |
| Add retries to force green samples | A failed sample is evidence, not noise to hide. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Primary platform | macOS with WebKit and Chrome profiles | WebKit is native on macOS; Chrome provides the engine-matched control. | yes |
| Workload | Exact five-route contract in `app/lib/browser-bench/contract.ts` | It is the existing direct-comparison inventory. | yes |
| Sample protocol | One discarded command per profile and five interleaved valid commands per phase | Matches the established repository benchmark protocol. | yes |
| Warm semantics | One in-session five-route warmup per warm command, recorded but excluded from action time | Makes every measured action operate on a live, warmed driver. | yes |
| Remaining implicit dimensions | N/A for auth, persistence, rate limits, and state transitions | The spike is anonymous, ephemeral, read-only, and local. | yes |

**Open questions:** none.

## User Stories

### P1: Matched Playwright Test drivers

**User Story**: As the maintainer, I want Playwright Test to execute the same
public smoke contract through Page and WebView so that harness ergonomics do not
force a second standalone runner.

**Acceptance Criteria**:

1. WHEN the local Page project runs THEN the system SHALL execute exactly the five ordered route IDs from `BROWSER_SMOKE_ROUTE_IDS` through headless Playwright Chromium.
2. WHEN either local WebView project runs THEN the system SHALL execute exactly the same five ordered route IDs through Bun.WebView without requesting Playwright `page`, `browser`, or `context` fixtures.
3. WHEN a route completes THEN the system SHALL assert every status, language, heading, body-text, and canonical-path value defined for that route in the shared contract.
4. IF a local driver test fails THEN the system SHALL attach a PNG screenshot when the driver is still available.
5. The system SHALL keep `playwright.config.ts`, `tests/e2e/**`, the existing `test:e2e*` commands, `Makefile`, and CI behavior unchanged.

**Independent Test**: List and run each isolated project, confirm five passing
route tests per project, then run the canonical Chromium suite and confirm 49/49.

### P1: Controlled lifecycle benchmark

**User Story**: As the maintainer, I want cold and warm measurements separated
so that the result shows whether cost lives in startup, browser actions, or
teardown.

**Acceptance Criteria**:

1. WHEN a cold cohort runs THEN the system SHALL discard one command per profile and retain five valid commands in alternating profile order.
2. WHEN a warm cohort runs THEN the system SHALL record one in-session five-route warmup separately before each measured five-route action pass.
3. WHEN a measured sample completes THEN the system SHALL record wall time, startup, warmup when present, action time, teardown, residual overhead, process-tree peak RSS, and peak-RSS × wall-time.
4. WHEN results are persisted THEN the system SHALL include Bun runtime, browser engine/version, route outcomes, cleanup status, commands, sample order, host data, commit, and timestamp in raw JSON.
5. IF route parity, runtime provenance, process cleanup, timeout, or exit status validation fails THEN the system SHALL mark the sample invalid and SHALL make no winner claim from that sample.
6. WHEN the report compares profiles THEN the system SHALL label WebKit as cross-engine and SHALL use WebView Chrome for the direct Chromium-matched comparison.

**Independent Test**: Run the local benchmark and inspect one discarded sample
plus five valid samples for every profile/phase with exact route parity.

## Edge Cases

- IF Bun.WebView is unavailable in a Playwright worker THEN the suite SHALL fail with the missing runtime capability instead of falling back to Playwright Page.
- IF the Chrome backend cannot use Playwright's Chromium executable THEN that profile SHALL be invalid without changing the WebKit or Page results.
- IF any measured process group survives cleanup THEN that sample SHALL be invalid.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HYBRID-01 | Matched Playwright Test drivers | Design | Implementing |
| HYBRID-02 | Matched Playwright Test drivers | Design | Implementing |
| HYBRID-03 | Controlled lifecycle benchmark | Design | In Tasks |
| HYBRID-04 | Controlled lifecycle benchmark | Design | In Tasks |
| HYBRID-05 | Preserve canonical E2E boundary | Design | In Tasks |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped.

## Success Criteria

- [ ] All three local projects produce the same five passing route outcomes.
- [ ] Cold and warm cohorts each retain five valid samples per profile.
- [ ] The canonical Chromium suite still passes 49/49.
- [ ] The report states where measured cost lives without comparing incompatible lifecycles.
