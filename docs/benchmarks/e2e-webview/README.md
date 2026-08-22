# Bun Playwright vs Bun.WebView

This local benchmark compares browser automation overhead using five identical
public-route smoke scenarios.

## Commands

```sh
bun run test:e2e          # full Playwright suite through Bun
bun run test:e2e:bun      # explicit Bun Playwright route
bun run test:e2e:node     # Node fallback
bun run test:e2e:webview  # local five-scenario WebView smoke suite
bun run bench:e2e:webview # warm-up + five interleaved comparison runs
```

## Comparison boundary

Both benchmark arms use Bun 1.4, one shared Bun server, the same seeded PGLite
database, the same Playwright Chromium executable, a 1280×720 viewport, and the
same DOM snapshot assertions. Server startup and dependency installation are
outside measured process groups.

The scenarios cover English and Portuguese fixture posts, both locale indexes,
and the not-found route. Authentication, analytics, permissions, request
inspection, traces, and the rest of the 49-test Playwright inventory remain
Playwright-only.

The complete evaluation produces two reports:

- **cold**: one recorded warm-up plus five timed browser startups per arm. The
  primary result excludes warm-up; a second table includes all six samples.
- **warm-session**: two sessions per arm in reversed order. Each session keeps
  one browser open for one recorded warm-up pass plus five timed passes, giving
  ten measured passes per arm. A separate table reports whole-process cost.

Reports record pass and process time, sampled process-group peak RSS, browser
RSS after each pass, load, executable provenance, and per-scenario outcomes.
Reports are invalid when browser paths, viewport, scenario inventories,
outcomes, sample counts, or exit statuses differ.

Bun.WebView is experimental and local-only. These reports cannot justify
removing Playwright or adding WebView to CI.
