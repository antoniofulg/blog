# Playwright Test with Bun.WebView hybrid evaluation

## Verdict

Playwright Test can host Bun.WebView as a custom fixture. This does not produce
an engine-matched performance win. With the same Chrome for Testing 148 binary,
Bun.WebView Chrome was 62.56% slower cold and 42.07% slower warm than a normal
Playwright Page. Its measured five-route actions were also 159.30% slower cold
and 205.29% slower warm.

WebView WebKit was faster and used far less memory, but that is cross-engine
evidence. It cannot be attributed only to Bun or to removing Playwright's Page
abstraction. The action deltas remained inside the five-sample noise band; the
robust gains were whole-command wall time and memory occupancy.

Result: keep Playwright Page for the complete E2E suite. Keep this hybrid harness
as a local experiment and possible lightweight WebKit smoke. Do not build a
mixed Page/WebView compatibility layer for the 49 canonical tests.

## Final controlled run

- Raw data: [JSON](runs/run-2026-08-25T18-23-45-236Z.json)
- Generated summary: [Markdown](runs/run-2026-08-25T18-23-45-236Z.md)
- Commit measured: `47f1f17d6226405440dc6a7531d87329ed21cd52`
- Runtime: Bun 1.4.0 for Playwright Test and every driver project
- Host: Apple M3 Pro, 11 cores, macOS
- Inventory: five ordered public routes per pass
- Samples: 36 total, 36 valid, zero retries, zero invalid outcomes
- Protocol: one discarded command plus five measured commands per profile and phase
- Memory: peak RSS of the detached runner+driver process tree; server excluded
- Locks: `/tmp/praxis-playwright.lock` and the shared Creatista benchmark lock

### Direct engine-matched result

Both rows below use Playwright Test through Bun and the same Chrome for Testing
148 executable. Only the driver changes.

| Phase | Playwright Page wall | WebView Chrome wall | Wall delta | Page actions | WebView actions | Action delta | Page peak RSS | WebView peak RSS | RSS×time delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cold | 2639.59 ms | 4290.78 ms | +62.56% | 741.82 ms | 1923.54 ms | +159.30% | 932.7 MiB | 994.7 MiB | +74.44% |
| Warm | 4248.58 ms | 6035.99 ms | +42.07% | 621.18 ms | 1896.40 ms | +205.29% | 875.4 MiB | 992.7 MiB | +67.59% |

Positive deltas are regressions relative to Playwright Page. Warm wall includes
one in-session warmup pass in both arms; the action columns exclude it.

### WebKit cross-engine result

| Phase | Playwright Page wall | WebView WebKit wall | Wall delta | Page actions | WebKit actions | Action delta | Page peak RSS | WebKit peak RSS | RSS×time delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cold | 2639.59 ms | 1729.43 ms | -34.48% | 741.82 ms | 629.16 ms | -15.19% | 932.7 MiB | 316.3 MiB | -77.43% |
| Warm | 4248.58 ms | 2255.52 ms | -46.91% | 621.18 ms | 383.36 ms | -38.29% | 875.4 MiB | 302.0 MiB | -80.60% |

Negative deltas favor WebKit. Both action-time deltas were classified
`within-noise`; the wall-time deltas were classified `faster`.

## Cost breakdown

| Phase | Driver | Wall | Worker startup | Driver setup | Internal warmup | Measured actions | Driver teardown | Runner residual | Peak RSS | RSS×time |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cold | Playwright Page | 2639.59 ms | 841.33 ms | 814.75 ms | — | 741.82 ms | 93.89 ms | 838.36 ms | 932.7 MiB | 2.413 GiB·s |
| Cold | WebView WebKit | 1729.43 ms | 353.13 ms | 341.20 ms | — | 629.16 ms | 0.07 ms | 762.00 ms | 316.3 MiB | 0.545 GiB·s |
| Cold | WebView Chrome | 4290.78 ms | 1450.62 ms | 1433.50 ms | — | 1923.54 ms | 0.16 ms | 981.87 ms | 994.7 MiB | 4.209 GiB·s |
| Warm | Playwright Page | 4248.58 ms | 1301.45 ms | 1282.82 ms | 843.64 ms | 621.18 ms | 143.94 ms | 925.51 ms | 875.4 MiB | 3.597 GiB·s |
| Warm | WebView WebKit | 2255.52 ms | 383.23 ms | 371.41 ms | 497.99 ms | 383.36 ms | 0.12 ms | 925.30 ms | 302.0 MiB | 0.698 GiB·s |
| Warm | WebView Chrome | 6035.99 ms | 1491.39 ms | 1479.29 ms | 1935.54 ms | 1896.40 ms | 0.47 ms | 959.66 ms | 992.7 MiB | 6.029 GiB·s |

The residual Playwright Test cost stayed in a narrow 762-982 ms range. The large
differences came from browser/driver setup and actions. This answers the original
question: keeping Playwright Test as the harness is technically viable, but
putting Bun.WebView Chrome underneath it does not remove the dominant Chrome
automation cost on this workload.

## Warmup accounting

Two warmup layers are preserved in raw data:

1. One whole command per profile/phase warms host caches. It is retained as
   `kind: warmup` but excluded from the primary five-sample median.
2. Every warm sample runs one five-route pass in the same driver session before
   its measured action pass. That duration is reported as `internalWarmupMs`,
   included in warm wall time, and excluded from action time.

| Phase | Driver | Discarded command | Primary median (5) | Median including command warmup (6) | Internal warmup + measured actions |
| --- | --- | ---: | ---: | ---: | ---: |
| Cold | Playwright Page | 6206.79 ms | 2639.59 ms | 2692.33 ms | — |
| Cold | WebView WebKit | 2548.82 ms | 1729.43 ms | 1793.19 ms | — |
| Cold | WebView Chrome | 3977.67 ms | 4290.78 ms | 4277.36 ms | — |
| Warm | Playwright Page | 3020.71 ms | 4248.58 ms | 3937.17 ms | 1464.82 ms |
| Warm | WebView WebKit | 2394.18 ms | 2255.52 ms | 2324.85 ms | 881.35 ms |
| Warm | WebView Chrome | 7304.03 ms | 6035.99 ms | 6287.74 ms | 3831.94 ms |

The six-command medians show that discarding the first command did not create
the final verdict. WebView Chrome still loses; WebKit still wins whole-command
time and memory.

## What changed for this experiment

- Added a separate `playwright.webview.config.ts`; canonical config stays untouched.
- Added one Playwright Test fixture with no built-in `page`, `browser`, or
  `context` dependency. Project name selects Playwright Page, WebView WebKit, or
  WebView Chrome.
- Added one shared spec. Functional mode declares five route tests; benchmark
  mode declares one test that runs a complete route pass and emits structured
  lifecycle data.
- Forced WebView Chrome to use `chromium.executablePath()`, matching Playwright.
- Initialized WebView through `navigate("about:blank")` before `evaluate()`;
  Bun 1.4 Chrome otherwise fails with `'Runtime.evaluate' wasn't found`.
- Measured WebView status with an HTTP `HEAD` probe so the smoke does not replay
  the full route body.
- Disabled post-view analytics on servers owned by the hybrid config. Analytics
  is outside the five-route contract and its asynchronous PGLite writes had
  contaminated the next sample. Canonical E2E servers keep normal analytics
  behavior.
- Attached PNG screenshots on unexpected Playwright Test outcomes.
- Added a locked coordinator with rotating order, process-tree RSS, cleanup
  checks, exact route validation, runtime/browser provenance, and unique reports.

## Capability boundary

| Capability | Playwright Page | Bun.WebView fixture |
| --- | --- | --- |
| Playwright Test declarations, hooks, steps, reporters, retries/timeouts | Yes | Yes |
| Page/BrowserContext/semantic Locator API | Yes | No |
| `storageState`, auth fixtures, permissions | Yes | No native equivalent |
| Playwright traces | Yes | No |
| Screenshots and DOM evaluation | Yes | Yes |
| WebKit on macOS without browser download | Playwright bundle | System WebKit |
| Chromium on Linux/macOS | Yes | Yes, experimental Bun backend |
| Canonical 49-test coverage | Yes | No; five public routes only |

The two APIs can share the runner, assertions, tags, steps, timeouts, and result
attachments. They cannot control the same browser object. Any test that needs a
Playwright-only feature remains a Page test, which means a mixed full suite owns
two driver implementations and two capability surfaces.

## Commands

```sh
bun run test:e2e:webview:harness
bun run bench:e2e:webview:harness
```

The first runs the five WebKit smokes through Playwright Test. The second runs
all three profiles and writes timestamped JSON/Markdown evidence. Neither command
is part of CI or a default test route.

## Fresh local gates

| Gate | Result |
| --- | --- |
| `bun run test:bun` | 2272 passed, 101 environmental skips, 0 failed; 2373 tests across 134 files |
| Canonical `bun run test:e2e:bun -- --reporter=line` | 49/49 Chromium tests passed |
| Hybrid functional config | 15/15 tests passed: five each for Page, WebView WebKit, and WebView Chrome |
| TypeScript, Biome check/lint, lint-tests | Passed |

GitHub Actions was unavailable for credits. These are local gates; no CI file
or canonical Playwright configuration changed.
