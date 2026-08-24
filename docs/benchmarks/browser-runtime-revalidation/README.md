# Browser runtime revalidation

Status: local evidence complete; no default or CI change.

The canonical comparison is the five anonymous public outcomes shared by the
Playwright profile filter and the Bun.WebView harness:

1. English post renders.
2. Portuguese post renders.
3. Unknown route renders the not-found outcome (HTTP 404 is valid here).
4. English index renders.
5. Portuguese index renders.

## Controlled evidence

Each profile retains one discarded warm-up. A confirmed finalist requires five
valid samples. Process-tree RSS includes descendants; RSS×time is the median
peak RSS multiplied by median wall time and is a queue-pressure proxy, not an
RSS integral.

| Run | Scope | Result |
| --- | --- | --- |
| [screening JSON](runs/run-2026-08-24T22-49-36-109Z.json) / [Markdown](runs/run-2026-08-24T22-49-36-109Z.md) | Node/Bun Playwright workers 1/2; WebKit/Chrome cold/warm, one/two views, normal/`--smol`; one sample | WebKit 1-view normal and `--smol` warm passed; WebKit 2-view failed and was invalidated; Chrome profiles passed; Playwright parser was corrected after this run and its arms were not used as performance evidence |
| [Node Playwright finalist JSON](runs/run-2026-08-24T22-53-54-970Z.json) / [Markdown](runs/run-2026-08-24T22-53-54-970Z.md) | Node 24, Chromium, worker 1, five samples | 5/5 valid; median 6332.84 ms, 1196.2 MiB peak RSS, 7397.82 GiB·s RSS×time |
| [contaminated Bun attempt JSON](runs/run-2026-08-24T22-54-52-802Z.json) / [Markdown](runs/run-2026-08-24T22-54-52-802Z.md) | Bun 1.4, Chromium, worker 1 | Retained but excluded when external Playwright activity was detected |

The raw runs retain failed, excluded, and invalid profiles rather than hiding
them. The CRM machine lock and Antclips `lockf` lock are acquired before a
benchmark. The contamination sensor checks for Playwright/media-validation
processes outside this worktree and replenishes excluded attempts up to the
bounded attempt budget.

## Decision

Playwright remains the E2E reference. WebView remains experimental and
local-only. No WebView profile is promoted: it lacks the full Playwright
fixture, locator, authentication storage, trace, reporter, and request
inspection surface, and the available WebView finalists were not confirmed
with five uncontaminated samples across the matched runtime matrix.

The five-route smoke harness is useful as an opt-in diagnostic. It does not
replace the 49-test Playwright suite, does not change `test:e2e*`, does not
change `playwright.config.ts`, and is not enabled in CI. Playwright setup-project
startup is reported as overhead separately from the five canonical outcomes.

## Coverage and maintenance comparison

| Capability | Playwright | Bun.WebView smoke |
| --- | --- | --- |
| Full E2E suite and browser matrix | 49 tests; Chromium, Firefox, WebKit | Five anonymous routes only |
| Auth fixtures/storage state | Yes | No |
| Locators, traces, reporters, request inspection | Yes | No |
| Local startup cost | Includes setup-project overhead | Lower API surface, but experimental backend/process behavior |
| Maintenance | Existing CI/reference path | Additional opt-in harness and Bun experimental API |

The result is therefore a coverage-aware maintenance decision, not a claim
that a five-route WebView smoke can replace full browser E2E coverage.
