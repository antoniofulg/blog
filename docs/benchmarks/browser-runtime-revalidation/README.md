# Browser runtime revalidation

Status: harness remediated; prior evidence remains invalid until the approved
screening and finalist matrix is rerun. No default or CI change.

The canonical comparison is the five anonymous public outcomes shared by the
Playwright profile filter and the Bun.WebView harness:

1. English post renders.
2. Portuguese post renders.
3. Unknown route renders the not-found outcome (HTTP 404 is valid here).
4. English index renders.
5. Portuguese index renders.

## Controlled evidence

Each profile retains one discarded warm-up. Screening executes three measured
samples. A confirmed finalist requires five valid samples in a round-robin
schedule. Process-tree RSS includes descendants; RSS×time is the median peak
RSS multiplied by median wall time and is a queue-pressure proxy, not an RSS
integral. Schema-2 raw samples retain all five route identities, statuses and
errors, runtime/backend provenance, setup overhead, contamination phase,
cleanup status, and the cold/warm lifecycle boundary.

| Run | Scope | Result |
| --- | --- | --- |
| [previous screening JSON](runs/run-2026-08-24T22-49-36-109Z.json) / [Markdown](runs/run-2026-08-24T22-49-36-109Z.md) | Legacy schema-1 screening; one measured sample | Retained for audit only; invalid for finalist selection because it predates three-sample screening, lifecycle boundaries and exact route retention |
| [schema-2 sensor-check JSON](runs/run-2026-08-24T23-21-37-689Z.json) / [Markdown](runs/run-2026-08-24T23-21-37-689Z.md) | WebKit cold 1-view; three screening samples attempted | Retained as invalid evidence: external browser activity was detected before/during/after every sample; no finalist was selected |
| [schema-2 full screening JSON](runs/run-2026-08-25T00-26-03-716Z.json) / [Markdown](runs/run-2026-08-25T00-26-03-716Z.md) | Full Node/Bun + WebKit/Chrome matrix; one warm-up + three screening samples | Partial evidence: Node/Bun worker-2 and several WebView arms passed screening, but external CRM/Antclips browser trees contaminated finalist confirmation; no finalist promoted |
| [schema-2 rerun JSON](runs/run-2026-08-25T00-56-23-164Z.json) / [Markdown](runs/run-2026-08-25T00-56-23-164Z.md) | Full matrix after lock drain; one warm-up + three screening samples | Screening-only evidence: valid 1-view and Chrome arms retained, but finalist selection produced no confirmation; rerun required after selector fix |
| [schema-2 Node-2 confirmation attempt JSON](runs/run-2026-08-25T01-01-36-548Z.json) / [Markdown](runs/run-2026-08-25T01-01-36-548Z.md) | Node 24, Chromium, worker 2; one warm-up + five confirmation samples attempted | Invalidated and retained: external browser trees reappeared during the queued confirmation |
| [schema-2 finalist confirmation JSON](runs/run-2026-08-25T01-23-51-905Z.json) / [Markdown](runs/run-2026-08-25T01-23-51-905Z.md) | Node/Bun Playwright workers 1/2 plus WebKit cold 1-view normal/`--smol`; five interleaved rounds | WebKit normal/`--smol`, Node1 and Bun2 reached 5/5; Bun1 and Node2 were replenished in follow-up raw runs |
| [Bun1/Node2 follow-up JSON](runs/run-2026-08-25T01-25-57-686Z.json) / [Markdown](runs/run-2026-08-25T01-25-57-686Z.md) | Bun1 and Node2; five interleaved rounds | Both 5/5 valid; Bun1 median 4599.05 ms / 1286.6 MiB, Node2 median 5061.12 ms / 1205.0 MiB |
| [all-Playwright confirmation JSON](runs/run-2026-08-25T01-34-45-285Z.json) / [Markdown](runs/run-2026-08-25T01-34-45-285Z.md) | Node/Bun workers 1/2; five interleaved rounds | Bun1 and Node2 5/5; Node1/Bun2 each had one exclusion and were replenished in follow-ups |
| [Node1 follow-up JSON](runs/run-2026-08-25T01-37-23-067Z.json) / [Markdown](runs/run-2026-08-25T01-37-23-067Z.md) | Node1; five interleaved rounds | 5/5 valid; median 6428.67 ms / 903.0 MiB |
| [Bun2 follow-up JSON](runs/run-2026-08-25T01-43-21-673Z) / [Markdown](runs/run-2026-08-25T01-43-21-673Z.md) | Bun2; five interleaved rounds | 5/5 valid; median 12580.77 ms / 796.6 MiB |
| [Node Playwright finalist JSON](runs/run-2026-08-24T22-53-54-970Z.json) / [Markdown](runs/run-2026-08-24T22-53-54-970Z.md) | Node 24, Chromium, worker 1, five samples | 5/5 valid; median 6332.84 ms, 1196.2 MiB peak RSS, 7397.82 GiB·s RSS×time |
| [previous Bun attempt JSON](runs/run-2026-08-24T22-54-52-802Z.json) / [Markdown](runs/run-2026-08-24T22-54-52-802Z.md) | Legacy schema-1 Bun 1.4, Chromium, worker 1 | Retained for audit only; its contamination disposition is not trusted because raw and summary disagree |

The raw runs retain failed, excluded, and invalid profiles rather than hiding
them. The CRM machine lock and Antclips `lockf` lock are acquired before a
benchmark. The contamination sensor checks before, during and after each
sample for external browser activity and replenishes excluded attempts up to
the bounded attempt budget. Every measured process group is checked after
exit; cleanup failure invalidates the sample. Cold WebView profiles restart
the server and browser per sample. Warm profiles start one server and one
browser session, then execute the discarded warm-up and measured passes in
that session.

## Decision

Playwright remains the E2E reference. WebView remains experimental and
local-only. No WebView profile is promoted until a schema-2 run confirms a
valid non-dominated profile with five uncontaminated samples. The old reports
do not satisfy that gate and are not performance evidence.

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
