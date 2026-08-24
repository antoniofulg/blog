# Browser Runtime Revalidation Specification

**Status**: Approved for autonomous execution (2026-08-24)

## Problem Statement

The Blog already prefers Playwright through Bun and retired an experimental
Bun.WebView smoke harness. The Bun Test revalidation established stronger
benchmark controls and the maintainer requested that the same possibilities be
tested for Playwright and WebView. We need a controlled local comparison that
preserves Playwright as the E2E reference and does not change CI/defaults.

## Goals

- [ ] Revalidate Node- and Bun-hosted Playwright with workers 1/2.
- [ ] Recreate an equivalent local-only five-route Bun.WebView smoke suite.
- [ ] Evaluate WebKit/Chrome, cold/warm, serial/parallel-view and `--smol` possibilities.
- [ ] Measure wall time, process-tree peak RSS, RSS×time and outcome parity.
- [ ] Preserve raw evidence and a reversible recommendation.

## Out of Scope

| Item | Reason |
| --- | --- |
| Replacing the 49-test Playwright suite | WebView lacks Playwright's coverage/tooling and remains experimental. |
| CI/default changes | This is local evidence only. |
| Product behavior changes | The harness adapts to the app, not vice versa. |
| Browser-matrix removal | Chromium, Firefox and WebKit remain required Playwright projects. |

## Assumptions & Open Questions

| Topic | Decision |
| --- | --- |
| Reference | Existing Playwright five-route public smoke subset |
| Runtimes | Node 24 and Bun 1.4 for Playwright; Bun 1.4 for WebView |
| Engines | Playwright Chromium; WebView WebKit and Chrome |
| Samples | One discarded warm-up + screening, then at least five valid samples for finalists |
| Memory | Process-tree RSS; peak limit plus RSS×time/queue release |
| Coordination | Existing CRM/Antclips shared locks and external-load sensor |
| Persistence | Timestamped JSON/Markdown under `docs/benchmarks/browser-runtime-revalidation/` |

**Open questions**: none; the user authorized autonomous local evaluation.

## User Stories

### P1: Comparable Playwright profiles

**User Story**: As the maintainer, I want Node/Bun and worker profiles measured
under identical browser conditions so that runtime and concurrency effects are attributable.

1. The system SHALL run the same Playwright smoke inventory in every arm.
2. WHEN comparing Node and Bun THEN browser, server, workers, retries, artifacts and environment SHALL match.
3. WHEN workers 1/2 are screened THEN failures or resource contention SHALL invalidate that profile.
4. WHEN finalists run THEN each SHALL have one discarded warm-up and at least five valid interleaved samples.
5. The system SHALL record runtime provenance, outcomes, wall time, process-tree RSS and RSS×time.

### P1: Equivalent Bun.WebView smoke

**User Story**: As the maintainer, I want WebView measured on the same public
routes so that startup speed is not confused with equivalent E2E coverage.

1. The system SHALL implement the same five route/status/content outcomes as the Playwright subset.
2. The system SHALL evaluate WebKit and Chrome backends separately.
3. WHEN warm sessions or parallel views are measured THEN the report SHALL distinguish browser-process reuse from cold process startup.
4. IF parallel views alter outcomes or increase memory disproportionately THEN the profile SHALL be invalid or dominated.
5. The system SHALL close every WebView and browser subprocess deterministically.
6. The system SHALL label WebView experimental and SHALL NOT add it to CI/default scripts.

### P1: Controlled decision evidence

**User Story**: As the maintainer, I want publishable raw evidence so that a
future post can explain speed, memory, coverage and maintenance trade-offs.

1. The system SHALL retain invalid/contaminated samples with reasons.
2. IF inventories/outcomes differ THEN the comparison SHALL not name a performance winner.
3. The final report SHALL separate full E2E capability from common-subset smoke performance.
4. The final report SHALL compare time, peak RSS, RSS×time and serialized queue throughput.
5. The system SHALL keep existing `test:e2e*`, Playwright config and CI semantics unchanged.

## Edge Cases

- Playwright setup project runs despite a smoke grep and changes inventory.
- Fixed port 4173 or global `/tmp` fixtures collide with another worktree.
- WebView Chrome reuses an existing browser while WebKit spawns its host.
- A WebView operation overlaps another operation in the same slot.
- A backend is unavailable or silently differs from the requested engine.
- Lock waiters are mistaken for active browser suites.
- Warm-session timing omits browser startup while cold timing includes it.
- Browser subprocess RSS is omitted from the parent measurement.

## Requirement Traceability

| ID | Requirement |
| --- | --- |
| BRR-01 | Equivalent Playwright smoke inventory |
| BRR-02 | Node/Bun workers 1/2 profiles |
| BRR-03 | Equivalent WebView WebKit/Chrome smoke |
| BRR-04 | Cold/warm/parallel/`--smol` screening |
| BRR-05 | Controlled repeated process-tree benchmark |
| BRR-06 | Coverage-aware local-only decision |

