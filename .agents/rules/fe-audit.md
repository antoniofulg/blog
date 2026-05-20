# FE Audit Rules (app-audit)

## Scope

`app-audit` is a **browser-sweep** skill. It walks every route × locale × auth-state
combination via Playwright, running 12 probe categories per inspection. It is NOT
a content-layer audit — for MDX source validation, use `content-audit` instead.

> **app-audit ≠ content-audit**: `app-audit` = runtime browser layer (console errors,
> network, a11y, Lighthouse). `content-audit` = MDX source layer (frontmatter, links,
> translations). Run both independently — they cover different surfaces.

> **app-audit ≠ a11y-testing**: `a11y-testing` targets component-level a11y in
> Vitest + jest-axe. `app-audit`'s `a11y-violation` probe is route-level via direct
> `AxeBuilder` calls. Both can coexist without conflict.

## Configuration

| CLI flag | Env var equivalent | Default | Description |
|----------|--------------------|---------|-------------|
| `--lighthouse` / `--no-lighthouse` | — | local: on, CI: off | Enable/disable Lighthouse probes |
| `--trigger=<label>` | — | `manual` | Label written to SUMMARY.md row |
| `--routes=<paths>` | — | all routes | Comma-separated route paths; normalizes trailing slash and case |
| `--baseUrl=<url>` | `AUDIT_BASE_URL` | `http://localhost:3000` | Override base URL for all route inspections |

`AUDIT_BASE_URL` is the environment-variable form of `--baseUrl`. When the flag is not provided, the orchestrator falls back to `AUDIT_BASE_URL`, then to `http://localhost:3000`. The GH Action workflow sets `AUDIT_BASE_URL=http://localhost:4173` to target the Vite preview server.

## Output Location

| Artifact | Path | Committed |
|----------|------|-----------|
| Per-run report | `docs/_reports/app-audit-YYYY-MM-DD.md` | No (gitignored) |
| Audit history | `docs/audits/SUMMARY.md` `Type: app` rows | Yes |
| Lighthouse HTML | `docs/_reports/lhr-*.html` | No (gitignored) |

`docs/_reports/` is gitignored. `docs/audits/SUMMARY.md` has a `Type` column
(`content` / `app`) added in Phase 4.

## Severity Scheme

| Severity | Exit code | CI behavior | Resolution SLA |
|----------|-----------|-------------|----------------|
| blocker | 1 | Workflow step fails | Fix within 7 days OR escalate OR suppress |
| major | 0 | Workflow passes; PR comment posted | Fix before promoting from draft |
| minor | 0 | Workflow passes; PR comment posted | Batch-fix acceptable |
| sweep-error | 0 (major) | Reported as major finding | Investigate root cause locally |

## Category Definitions

| Category | Severity | Trigger condition |
|----------|----------|------------------|
| `console-error` | blocker | `page.on("console")` where `msg.type() === "error"` |
| `hydration-mismatch` | blocker | Console message contains "hydration failed", "did not match", or "Text content does not match" |
| `network-fail` (5xx) | blocker | `response.status() >= 500` on any request |
| `network-fail` (4xx) | major | `response.status() >= 400 && < 500` on any request |
| `missing-meta` | major | Any of `<title>`, `<meta name="description">`, `og:title`, `og:image`, `<link rel="canonical">`, `<meta name="viewport">` is absent or empty |
| `broken-image` | major | `img` element with `naturalWidth === 0` at page-load time |
| `mixed-content` | major | Console message contains "Mixed Content" |
| `a11y-violation` | major | `AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag22aa"]).analyze()` returns violations |
| `slow-response` | minor | `performance.now()` delta > 1500ms for first-paint heuristic |
| `seo-score-drop` | minor | Lighthouse `categories.seo.score < 0.9` |
| `perf-budget-breach` | minor | Lighthouse `categories.performance.score < 0.8` |
| `best-practices-fail` | minor | Lighthouse `categories["best-practices"].score < 0.9` |
| `sweep-error` | major | Per-route try/catch catch block — probe infrastructure failure (timeout, browser crash, etc.); does NOT count toward abort condition |

## Finding Row Format

Per-run report finding format:

```markdown
- **<category>** (`<routePath>` <locale> <auth-state>)
  - <human-readable message>. <suggested fix>.
```

SUMMARY.md row format (append-only; never edit existing rows):

```markdown
| YYYY-MM-DD | <trigger> | app | <blocker-count> | <major-count> | <minor-count> | <top-finding> |
```

## Abort Condition

Evaluate retirement when **3 consecutive** audit runs both produce zero actionable
findings (blocker + major = 0, `sweep-error` excluded from count). Higher threshold
than `content-audit` (2 runs) — fuzzer nature surfaces more findings per run, so
noise floor is higher.

Record the evaluation decision in `docs/audits/SUMMARY.md` as a note row. If zero
findings persist for a full quarter, retire this skill and document in the ADR log.

## Triage Workflow

Every **blocker** finding must reach one of three states within 7 days:
1. **Fixed** — root cause resolved, finding no longer appears in next run.
2. **Escalated** — issue opened, owner assigned, SLA extended to issue close date.
3. **Suppressed** — explicit decision recorded in `docs/audits/SUMMARY.md` with rationale.

For **sweep-error** findings — investigate locally first:

```bash
bunx playwright test --headed --debug
```

This surfaces the root-cause assertion (hydration error, broken route, fixture
failure) that is causing the probe to time out or crash.

## Lighthouse Variance Management

- Lighthouse perf scores can swing ±10 points on shared CI runners between
  identical runs. Treat scores as **advisory**, not gate signals.
- CI runs with Lighthouse OFF by default (ADR-006). Enable via `workflow_dispatch`
  input `lighthouse: "true"` only for explicit perf/SEO investigation.
- If Lighthouse-driven false alarms exceed tolerance, disable with `--no-lighthouse`
  flag in CLI or by leaving `workflow_dispatch` input at default `"false"`.
- Future follow-up entry criteria (PRD-008): add per-run Lighthouse baseline + ±N-point
  tolerance band to suppress variance-driven re-posts automatically.
- **Chromium coupling risk**: `@lhci/cli` shares Playwright's bundled Chromium binary.
  If Playwright Chromium version predates lhci's minimum supported version after a
  Playwright upgrade, fall back to `@lhci/cli`'s own Chrome download by removing
  `chromePath` from the lhci config in `app/lib/app-audit/lighthouse.server.ts`.
- **Timeout orphan risk**: `lighthouse.server.ts` uses `Promise.race` to enforce a 30 s
  timeout. On timeout, the rejected promise returns control to the caller, but
  `@lhci/cli`'s `LighthouseRunner` does not expose a cancellation API — the spawned
  Chromium child process continues running until the Node process exits. In a short-lived
  `bun run audit:fe` invocation this is harmless (the child is reaped when the process
  exits). In a long-lived orchestrator that loops through many audits (CI matrix, cron,
  repeated local runs), multiple timeout events can accumulate zombie Chromium processes
  and exhaust file descriptors or RAM. Keep each audit invocation as a separate process
  rather than running the orchestrator in a long-lived loop.

## Concurrent Run Safety

Do **not** run `audit-fe` and `audit-content` concurrently against the same
`docs/audits/SUMMARY.md`. Both tools use `fs.appendFile` (not atomic across
processes); concurrent writes can produce garbled markdown table rows that
persist in git history. Sequential invocation via `make audit` is the only
supported path. V2 may add a lockfile if CI parallelism requires it.

## Fingerprint Collision Avoidance

App-audit PR comment fingerprint: `<!-- audit-fingerprint:app:blocker=X major=Y -->`

Content-audit fingerprint: `<!-- audit-fingerprint:content:blocker=X major=Y -->`

Workflow uses `grep -F "<!-- audit-fingerprint:app:"` (literal-string match, not
regex). The `:app:` and `:content:` segments MUST never be changed — they prevent
cross-audit comment collision on the same PR.
