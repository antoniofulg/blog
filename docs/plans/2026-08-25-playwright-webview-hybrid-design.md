# Playwright Test with Bun.WebView hybrid evaluation

## Goal

Measure whether Playwright Test can remain the test harness while Bun.WebView
replaces Playwright Page for compatible public smoke tests. Keep the canonical
49-test Playwright suite, its configuration, and CI unchanged.

## Chosen approach

Use one isolated Playwright Test configuration with three local projects:

1. Playwright Page with headless Chromium.
2. Bun.WebView with macOS WebKit.
3. Bun.WebView with the same Chromium executable used by Playwright.

All projects run through `bunx --bun playwright test`. A custom fixture owns the
driver. Its dependency list does not request Playwright's built-in `page`,
`browser`, or `context` fixtures, so the WebView projects do not launch a
Playwright browser. The Page project explicitly launches a normal Playwright
Browser and Page inside the same fixture contract.

The fixture and specs live outside `tests/e2e/`. The default Playwright config
cannot discover them. The five assertions come from
`app/lib/browser-bench/contract.ts` and cover the same route inventory in the
same order for every project.

## Boundaries

```text
canonical E2E                              local hybrid spike
playwright.config.ts                       playwright.webview.config.ts
tests/e2e/**                               tests/e2e-webview/**
49 tests                                  5 matched public smokes × 3 drivers
CI gate                                   never discovered by CI/defaults
```

Playwright Test provides test declaration, expectations, hooks, projects,
timeouts, reporters, `test.step`, and `testInfo.attach`. The driver provides
navigation, DOM evaluation, browser identity, screenshots, and cleanup.

Playwright `Locator`, `storageState`, traces, and BrowserContext APIs remain
bound to Playwright Page. They cannot be applied to a Bun.WebView instance.
Tests requiring those capabilities stay in `tests/e2e/`.

## Benchmark method

The benchmark starts and seeds one Bun E2E server outside the measured arms.
Each sample launches Playwright Test through Bun with one project and one worker.
Both phase cohorts use one discarded host-cache sample followed by five valid
samples in alternating project order.

### Cold lifecycle

Each sample creates the harness and driver, runs one five-route pass, closes the
driver, and exits. Wall time and process-tree peak RSS cover the complete command.

### Warm action

Each sample creates the harness and driver, runs one complete in-session warmup
pass, records it separately, then measures a second five-route pass before
cleanup. Warm action time excludes the in-session warmup. Whole-command wall
time includes it and is reported separately.

The report records:

- command wall time;
- fixture/driver startup;
- discarded in-session warmup, when present;
- measured route actions;
- driver teardown;
- residual runner overhead;
- process-tree peak RSS;
- peak-RSS × wall-time occupancy proxy;
- runtime and browser provenance;
- route identities and outcomes;
- execution order, warmups, invalid samples, and cleanup status.

Comparisons are invalid when route inventories differ, an assertion fails, a
process times out, cleanup leaves descendants, or runtime provenance is not Bun
1.4. WebKit and Chromium results are labeled as different engines. The direct
engine-matched comparison is Playwright Page Chromium versus Bun.WebView Chrome.

## Failure evidence

The fixture attaches a PNG screenshot on failure when the driver remains alive.
Structured route outcomes are attached to the Playwright result. Benchmark raw
JSON and Markdown are written under
`docs/benchmarks/playwright-webview-hybrid/runs/` with unique timestamps.

## Constraints

- No dependency is added.
- No canonical E2E file, config, command, worker count, or CI job changes.
- No full-suite WebView port is attempted.
- No winner claim compares a warm action with a cold command.
- Bun.WebView remains experimental and local-only after the spike.

