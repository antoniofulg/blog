# Bun Playwright and WebView evaluation

## Goal

Run the existing Playwright E2E gate through Bun while retaining an explicit
Node fallback. Add a local-only Bun.WebView smoke suite and a controlled
benchmark that can compare WebView with Bun-driven Playwright without changing
CI or replacing the 49-test Playwright suite.

## Commands

- `test:e2e`: full Playwright suite forced through Bun.
- `test:e2e:node`: full Playwright suite through Node 24 fallback.
- `test:e2e:webview`: local Bun.WebView smoke suite.
- `bench:e2e:webview`: local Playwright-versus-WebView benchmark.

CI remains unchanged in this phase.

## Architecture

The existing Playwright configuration, fixtures, reporters, Chromium project,
single worker, Bun web server, PGLite lifecycle, traces, retries, and screenshots
remain the primary E2E coverage.

The WebView suite is separate and intentionally small. It covers deterministic
public routes only. It does not recreate Playwright locators, authentication
storage, request inspection, permissions, traces, or reporters. The local runner
starts the existing Bun E2E server, reuses the existing seed/setup flow, executes
the smoke scenarios, and always closes WebView and the server.

The benchmark starts and seeds one Bun server outside the measured arms. Each
arm runs in its own child process:

1. Bun + Playwright library + Chromium.
2. Bun.WebView + the same Chromium executable.

Both arms use the same scenarios, base URL, viewport, order, and one browser at
a time. One warm-up is discarded. Five timed repetitions alternate arm order.
Each sample records wall time, peak RSS, runtime/browser provenance, passed and
failed scenarios, and a failure excerpt. A comparison is invalid if inventories
or outcomes differ. Timestamped JSON and Markdown reports never overwrite prior
runs.

## Failure handling

- Missing Bun.WebView or Chromium fails with an actionable error.
- Browser, scenario, seed, and server failures remain visible; no silent retry
  turns a failed sample green.
- Screenshots are written for WebView scenario failures when a view exists.
- Child browsers and the E2E server are terminated in `finally` paths.
- Benchmark reports make no winner claim when the comparison is invalid.

## Validation

- Static tests assert all three E2E commands and the unchanged CI boundary.
- Unit tests cover scenario parity, benchmark ordering, outcome invalidation,
  statistics, and unique report paths.
- Run Node fallback, Bun Playwright, and WebView smoke commands.
- Run one warm-up plus five interleaved benchmark repetitions.
- Run typecheck, lint, lint-tests, build, and the full Bun Playwright suite.

## Constraints

Bun.WebView is experimental and local-only. It does not enter CI, replace
Playwright, or count as Bun Test cutover evidence. The implementation adds no
new dependency and uses the installed Playwright Chromium for an engine-matched
comparison.
