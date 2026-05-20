---
name: app-audit
description: >
  FE-runtime browser sweep for this blog. Uses the site-model as a route
  classifier and Playwright to walk every route × locale × auth-state
  combination, running 12 probe categories (console errors, hydration
  mismatches, network failures, broken images, missing meta tags,
  mixed-content warnings, slow responses, a11y violations, Lighthouse
  perf/SEO/best-practices, and sweep errors).
  Use when asked to "audit FE", "run browser sweep", "find runtime bugs",
  "check meta tags", "find hydration mismatches", or "run app-audit".
  Do NOT activate on "general review", "audit code", "audit security",
  "unit test", "content audit", or "check translations".
context: fork
version: 1.0.0
tags: [app-audit, browser-sweep, playwright, a11y, lighthouse, runtime, audit]
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
user-invocable: true
---

# app-audit

FE-runtime audit for `blog`. Uses `getRouteInventory()` from
`app/lib/site-model.server.ts` as the route classifier (fuzzer pattern —
site-model is not an oracle, just a classifier). Canonical entrypoint:
`scripts/audit-fe.ts`.

> **Not `content-audit`**: this skill validates runtime browser behavior
> (console errors, a11y, perf). `content-audit` validates MDX source files.
> They cover different surfaces and do not overlap.

> **Not `e2e-coverage`**: e2e-coverage writes Playwright specs for route
> behavior regressions. `app-audit` sweeps all routes without writing specs.

## Scope

- **Input**: `getRouteInventory()` route list × `["en", "pt-br"]` × `["anon", "admin"]`
- **~28 inspections per run** at current site scale
- **Browser required** — Playwright + axe-core + optional Lighthouse
- **No DB writes** — read-only except SUMMARY.md append

## Categories

| Category | Severity | Description |
|----------|----------|-------------|
| `console-error` | blocker | `page.on("console")` filter on `type() === "error"` |
| `hydration-mismatch` | blocker | Console filter for "hydration failed" / "did not match" / "Text content does not match" |
| `network-fail` | blocker (5xx) / major (4xx) | `page.on("requestfailed")` + `response.status() >= 400` |
| `missing-meta` | major | `<title>`, `<meta name="description">`, `og:title`, `og:image`, `canonical`, `viewport` present + non-empty |
| `broken-image` | major | `img` elements with `naturalWidth === 0` |
| `mixed-content` | major | Console filter for "Mixed Content" warnings |
| `a11y-violation` | major | `AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag22aa"]).analyze()` |
| `slow-response` | minor | First-paint > 1.5 s via `performance.now()` heuristic |
| `seo-score-drop` | minor | Lighthouse `categories.seo.score < 0.9` |
| `perf-budget-breach` | minor | Lighthouse `categories.performance.score < 0.8` |
| `best-practices-fail` | minor | Lighthouse `categories["best-practices"].score < 0.9` |
| `sweep-error` | major | Per-route try/catch — probe infrastructure failure; NOT counted toward abort condition |

## Severity Scheme

- **blocker** — exit code 1; CI step fails; fix within 7 days or escalate
- **major** — reported; does not fail CI; fix before promoting draft
- **minor** — informational; Lighthouse scores advisory by default
- **sweep-error** — major severity; probe failed; investigate locally with `--headed --debug`

## Lighthouse Behavior

- **Locally** (no `CI` env var): Lighthouse ON by default
- **CI** (`CI=true`): Lighthouse OFF by default
- **Override**: `--lighthouse` / `--no-lighthouse` flags
- **GH Action**: `workflow_dispatch` input `lighthouse` (default `"false"`) — set `"true"` for explicit perf/SEO check

Rationale (ADR-006): Lighthouse perf scores swing ±10 points on shared CI
runners. Local-on captures pre-publish sanity check; CI-off avoids comment fatigue.

## Output Paths

| Artifact | Path | Committed |
|----------|------|-----------|
| Per-run report | `docs/_reports/app-audit-YYYY-MM-DD.md` | No (gitignored) |
| Audit history | `docs/audits/SUMMARY.md` | Yes — `Type: app` rows |
| Lighthouse HTML | `docs/_reports/lhr-*.html` | No (gitignored) |

`docs/_reports/` is gitignored. `docs/audits/SUMMARY.md` is committed — rows have
a `Type` column (`content` vs `app`) added in Phase 4.

## Invocation

```bash
# CLI — exits 1 if any blocker findings
bun run audit:fe

# With Lighthouse enabled explicitly
bun run audit:fe -- --lighthouse

# Composite — runs content-audit then app-audit
make audit

# Targeted audit-fe alias
make audit-fe
# or
make app-audit

# Slash command (agent conversation)
/app-audit
```

The GH Action `.github/workflows/app-audit.yml` runs automatically on PRs
touching `app/routes/**`, `app/components/**`, `app/lib/**`, or
`app/db/schema.ts`, and on `workflow_dispatch`.

## Finding Row Format

Each finding in the per-run report:

```markdown
- **<category>** (`<route>` <locale> <auth-state>)
  - <human-readable message>. <suggested fix>.
```

SUMMARY.md row format (Type column added in Phase 4):

```markdown
| YYYY-MM-DD | <trigger> | app | <blocker> | <major> | <minor> | <top-finding> |
```

## Abort Condition

If **3 consecutive** audit runs both produce zero actionable findings
(blocker + major = 0, excluding `sweep-error`), evaluate whether the audit
adds ongoing value. Higher threshold than `content-audit` (which uses 2 runs)
reflects app-audit's fuzzer nature — it naturally surfaces more findings per run.

Document the retirement decision in `docs/audits/SUMMARY.md`.

## Related

- `scripts/audit-fe.ts` — CLI entry point; exports `runAppAuditCli`
- `app/lib/app-audit/browser-sweep.server.ts` — sweep loop + 12 probes
- `app/lib/app-audit/checks.server.ts` — orchestrator; calls sweep + reporter
- `app/lib/app-audit/a11y-adapter.server.ts` — axe-core integration
- `app/lib/app-audit/lighthouse.server.ts` — `@lhci/cli` integration (shared Chromium binary)
- `app/lib/app-audit/reporter.server.ts` — markdown report + SUMMARY append
- `.agents/rules/fe-audit.md` — severity scheme, category definitions, triage workflow
- `.github/workflows/app-audit.yml` — CI surface (paths-filtered + workflow_dispatch)
- `content-audit` skill — non-overlapping companion (MDX source layer)
- `e2e-coverage` skill — non-overlapping companion (spec-based route regression)
