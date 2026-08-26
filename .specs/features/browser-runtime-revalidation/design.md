# Browser Runtime Revalidation Design

**Status**: Approved by autonomous execution authorization

## Common smoke contract

Use five anonymous public outcomes already covered in
`tests/e2e/public-read.spec.ts`:

1. English post route renders expected content.
2. Portuguese post route renders expected content.
3. Unknown route returns/renders not-found behavior.
4. English locale index renders.
5. Portuguese locale index renders.

The contract is represented once as data and consumed by Playwright filtering
and the WebView harness where practical. Runner-specific assertions remain native.

## Screening matrix

### Playwright

| Runtime | Workers | Artifacts |
| --- | ---: | --- |
| Node 24 | 1, 2 | current local policy |
| Bun 1.4 | 1, 2 | current local policy |

Screen each with one warm-up + three samples. Promote valid non-dominated
profiles to five-sample confirmation.

### WebView

| Backend | Session | Concurrency | Runtime mode |
| --- | --- | --- | --- |
| WebKit | cold, warm | serial, two views | normal, screened `--smol` |
| Chrome | cold, warm | serial, two views | normal, screened `--smol` |

Screen possibilities cheaply. Confirm only equivalent non-dominated finalists.

## Harness

Reuse process-group measurement, contamination detection, adaptive valid sample
collection and non-overwriting reports from Bun Test revalidation. The browser
server runs once per arm when measuring warm sessions and once per sample when
measuring cold process behavior; reports label this boundary explicitly.

Every WebView is closed with `await using` or `finally`; call `Bun.WebView.closeAll()`
after a failed sample. WebView uses ephemeral storage.

## Decision

Playwright remains the E2E reference. The report may recommend a WebView smoke
only if it is equivalent, materially beneficial, stable and cheap to maintain.
No result can replace multi-browser Playwright coverage.

