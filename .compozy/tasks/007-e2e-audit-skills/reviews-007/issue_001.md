---
provider: manual
pr:
round: 7
round_created_at: 2026-05-20T04:43:24Z
status: resolved
file: app/lib/app-audit/lighthouse.server.ts
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Lighthouse import broken — LighthouseRunner not exported at expected path

## Review Comment

First real `make audit` execution produced `docs/_reports/app-audit-2026-05-20.md` with 12 instances of:

```
Lighthouse failed: undefined is not a constructor
(evaluating 'new (_require("@lhci/cli/src/collect/node-runner.js")).LighthouseRunner')
```

`app/lib/app-audit/lighthouse.server.ts` imports `LighthouseRunner` from `@lhci/cli/src/collect/node-runner.js`, but that path does not export the constructor under that name. Every Lighthouse-enabled route inspection (12 routes × 1 lighthouse call) fails before reaching Chromium. The orchestrator's try/catch (round 5 issue 006 fix at `checks.server.ts:68-79`) catches the rejection and emits a `sweep-error` finding per route — so the audit completes without crashing, but Lighthouse is 100% non-functional.

Three possible root causes:

1. **`@lhci/cli` doesn't expose programmatic API** — lhci is primarily a CLI tool; `node-runner.js` may be internal/private and the package surface is intended for `bunx lhci collect` invocation, not direct `require()`. Most common explanation.
2. **Package shape changed** since the version pinned in `package.json` — class name or export path moved between releases.
3. **Bun's `require()` resolution mismatches Node's** for this specific module — bun bundles `commonjs` differently than Node and some internal lhci files may break.

This is a high-severity correctness regression: ADR-006 decision 2 + decision 1 explicitly include Lighthouse as a V1 category set. As-shipped, all Lighthouse-driven categories (`seo-score-drop`, `perf-budget-breach`, `best-practices-fail`) cannot fire — the entire perf/SEO/best-practices surface is dead code.

Round 6 issue 004 documented the orphaned-process risk for Lighthouse timeouts; this is more fundamental — the runner never gets instantiated at all.

**Suggested fix:** verify lhci's actual API surface:

```bash
node -e "console.log(Object.keys(require('@lhci/cli/src/collect/node-runner.js')))"
# OR inspect:
cat node_modules/@lhci/cli/src/collect/node-runner.js | head -30
```

Based on findings, choose one path:

1. **Use Lighthouse directly** (not lhci): `import lighthouse from 'lighthouse'` + `import { launch } from 'chrome-launcher'` or pass Playwright's CDP endpoint. This is the documented programmatic API. `@lhci/cli` is a wrapper around it.
2. **Shell out to lhci CLI**: spawn `bunx lhci collect --url=<url> --settings.chromePath=<path>` via `node:child_process`, parse the JSON output. Heavier but uses lhci's supported surface.
3. **Drop Lighthouse from V1** entirely; ship `seo-score-drop` etc. as `not-implemented` placeholders until a working integration lands.

Option 1 is the cleanest fix. Add a Vitest test that asserts `runLighthouse()` returns a valid `LighthouseScores` object against a fixture URL (skip-by-default if `@lhci/cli` not installed).

## Triage

- Decision: `valid`
- Root cause: `module.exports = LighthouseRunner` (class exported directly). Accessing `.LighthouseRunner` on it returns `undefined`. `new undefined()` → "undefined is not a constructor".
- Fix: remove `.LighthouseRunner` property access in `createLighthouseRunner`. Change cast from `_require(...).LighthouseRunner as new () => LighthouseRunner` to `_require(...) as new () => LighthouseRunner`.
