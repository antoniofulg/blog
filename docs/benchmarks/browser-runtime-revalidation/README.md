# Browser runtime revalidation

Status: complete local revalidation; Playwright remains reference and WebView
remains experimental. No default or CI change.

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
| [post-remediation confirmations JSON](runs/run-2026-08-25T04-16-32-724Z.json) / [Markdown](runs/run-2026-08-25T04-16-32-724Z.md) | Both queued locks; Node 24/Bun Playwright workers 1/2 plus WebKit warm 1-view normal/`--smol`; one warm-up + five measured samples with persistent-session trace | All six profiles 5/5 valid, exact setup + five routes, no invalid reasons; raw Pareto selects only WebKit warm 1-view `--smol` |
| [post-fix screening JSON](runs/run-2026-08-25T02-31-40-880Z.json) / [Markdown](runs/run-2026-08-25T02-31-40-880Z.md) | Complete Node/Bun workers 1/2 + WebKit/Chrome cold/warm, 1/2-view, normal/`--smol`; one warm-up + three screening samples | Programmatic Pareto selected WebKit warm 1-view normal/`--smol`; invalid arms retained with reasons |
| [post-fix confirmations JSON](runs/run-2026-08-25T02-34-46-895Z.json) / [Markdown](runs/run-2026-08-25T02-34-46-895Z.md) | Matched Playwright Node/Bun workers 1/2 plus both selected WebKit warm finalists; one warm-up + five interleaved valid samples | All six profiles 5/5 valid; no unresolved `invalidReasons` |
| [previous screening JSON](runs/run-2026-08-24T22-49-36-109Z.json) / [Markdown](runs/run-2026-08-24T22-49-36-109Z.md) | Legacy schema-1 screening; one measured sample | Retained for audit only; invalid for finalist selection because it predates three-sample screening, lifecycle boundaries and exact route retention |
| [schema-2 sensor-check JSON](runs/run-2026-08-24T23-21-37-689Z.json) / [Markdown](runs/run-2026-08-24T23-21-37-689Z.md) | WebKit cold 1-view; three screening samples attempted | Retained as invalid evidence: external browser activity was detected before/during/after every sample; no finalist was selected |
| [schema-2 full screening JSON](runs/run-2026-08-25T00-26-03-716Z.json) / [Markdown](runs/run-2026-08-25T00-26-03-716Z.md) | Full Node/Bun + WebKit/Chrome matrix; one warm-up + three screening samples | Partial evidence: Node/Bun worker-2 and several WebView arms passed screening, but external CRM/Antclips browser trees contaminated finalist confirmation; no finalist promoted |
| [schema-2 rerun JSON](runs/run-2026-08-25T00-56-23-164Z.json) / [Markdown](runs/run-2026-08-25T00-56-23-164Z.md) | Full matrix after lock drain; one warm-up + three screening samples | Screening-only evidence: valid 1-view and Chrome arms retained, but finalist selection produced no confirmation; rerun required after selector fix |
| [schema-2 Node-2 confirmation attempt JSON](runs/run-2026-08-25T01-01-36-548Z.json) / [Markdown](runs/run-2026-08-25T01-01-36-548Z.md) | Node 24, Chromium, worker 2; one warm-up + five confirmation samples attempted | Invalidated and retained: external browser trees reappeared during the queued confirmation |
| [schema-2 finalist confirmation JSON](runs/run-2026-08-25T01-23-51-905Z.json) / [Markdown](runs/run-2026-08-25T01-23-51-905Z.md) | Node/Bun Playwright workers 1/2 plus WebKit cold 1-view normal/`--smol`; five interleaved rounds | WebKit normal/`--smol`, Node1 and Bun2 reached 5/5; Bun1 and Node2 were replenished in follow-up raw runs |
| [Bun1/Node2 follow-up JSON](runs/run-2026-08-25T01-25-57-686Z.json) / [Markdown](runs/run-2026-08-25T01-25-57-686Z.md) | Bun1 and Node2; five interleaved rounds | Both 5/5 valid; Bun1 median 4599.05 ms / 1286.6 MiB, Node2 median 5061.12 ms / 1205.0 MiB |
| [all-Playwright confirmation JSON](runs/run-2026-08-25T01-34-45-285Z.json) / [Markdown](runs/run-2026-08-25T01-34-45-285Z.md) | Node/Bun workers 1/2; five interleaved rounds | Bun1 and Node2 5/5; Node1/Bun2 each had one exclusion and were replenished in follow-ups |
| [Node1 follow-up JSON](runs/run-2026-08-25T01-37-23-067Z.json) / [Markdown](runs/run-2026-08-25T01-37-23-067Z.md) | Node1; five interleaved rounds | 5/5 valid; median 6428.67 ms / 903.0 MiB |
| [Bun2 follow-up JSON](runs/run-2026-08-25T01-43-21-673Z.json) / [Markdown](runs/run-2026-08-25T01-43-21-673Z.md) | Bun2; five interleaved rounds | Historical evidence retained; superseded by post-fix confirmation |
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

## Fresh comparison

Medians below come from the six-profile post-remediation confirmation JSON. RSS×time is
`medianPeakRssBytes × medianMs`, converted to GiB·s. Serialized throughput is
`60000 / medianMs` samples/minute; it describes a serial queue, not parallel
capacity.

| Profile | Median time | Peak RSS | RSS×time | Throughput |
| --- | ---: | ---: | ---: | ---: |
| Playwright Node w1 | 6269.10 ms | 1236.5 MiB | 7.57 GiB·s | 9.57/min |
| Playwright Bun w1 | 6904.48 ms | 1105.1 MiB | 7.45 GiB·s | 8.69/min |
| Playwright Node w2 | 6971.18 ms | 1328.7 MiB | 9.05 GiB·s | 8.61/min |
| Playwright Bun w2 | 4788.34 ms | 1195.0 MiB | 5.59 GiB·s | 12.53/min |
| WebKit warm 1-view | 305.79 ms | 120.0 MiB | 0.04 GiB·s | 196.21/min |
| WebKit warm 1-view `--smol` | 297.52 ms | 115.9 MiB | 0.03 GiB·s | 201.67/min |

## Decision

Playwright remains the E2E reference. The fresh screening and confirmation
meet the local benchmark gate; both warm profiles were confirmed, but the raw
final Pareto set contains only WebKit warm 1-view `--smol` because it is faster
and lower RSS. WebView is still experimental and local-only, so no default, CI,
or Playwright configuration changes follow.

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
