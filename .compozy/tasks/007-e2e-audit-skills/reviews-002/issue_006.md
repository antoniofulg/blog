---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: playwright.config.ts
line: 36
severity: low
author: claude-code
provider_ref:
---

# Issue 006: Local first-run fails when .output/ missing; reuseExistingServer ambiguous

## Review Comment

`playwright.config.ts:33-39` configures the Playwright webServer as:

```ts
webServer: {
    command: "bun run scripts/e2e-server.ts",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
},
```

`scripts/e2e-server.ts:37` then spawns the Nitro production bundle at `.output/server/index.mjs`. If a developer runs `bunx playwright test` locally without first running `bun run build`, the child spawn fails immediately, e2e-server exits, Playwright times out waiting on `http://localhost:4173`, and the suite aborts with a non-actionable "webServer did not start" error. The build-before-e2e order is documented in TechSpec Build Order (step 1-4) and ADR-001 ("boot mode: bun preview … prod-like SSR"), but the config does not enforce it.

The `reuseExistingServer: !process.env.CI` option compounds the ambiguity. Locally, if a developer has an unrelated process listening on port 4173 (a previous `bun preview` from a different branch, a vite dev server, etc.), Playwright reuses it without verifying it is actually the e2e-server variant. The suite then runs against an unrelated server with no PGLite proxy, fails confusingly on session-cookie assertions, and the developer chases a phantom auth bug.

Neither failure mode breaks CI (CI sets `process.env.CI=true`, disabling reuse, and the workflow always rebuilds first), but both consume developer time on the local path that PRD-007 calls out as the primary onboarding flow ("invokes `/e2e-coverage` in Claude Code; the skill detects no Playwright present and offers to install dependencies + scaffold config").

**Suggested fix:** prepend a `bun run build` step inside `scripts/e2e-server.ts` (gated by a check for `.output/server/index.mjs` so it skips if up-to-date), OR add a pre-flight check in `scripts/e2e-server.ts:start` that errors with a clear "run `bun run build` first" message if the file is missing. For the reuse path, change `reuseExistingServer` to `false` outright; the 2-3 second cost of starting a fresh server per local run is small compared to debugging a wrong-server connection. Update `.agents/rules/testing.md` to document the boot order explicitly.

## Triage

- Decision: `valid`
- Root cause: Two problems: (1) `reuseExistingServer: !process.env.CI` allows Playwright to silently connect to a wrong existing server locally (no PGLite proxy), causing phantom auth failures. (2) `scripts/e2e-server.ts` spawns `.output/server/index.mjs` without checking if it exists — fails with a cryptic "webServer did not start" timeout instead of an actionable message.
- Fix applied:
  - `playwright.config.ts:36`: Changed `reuseExistingServer: !process.env.CI` → `reuseExistingServer: false`. Cost is negligible (~2-3s) compared to debugging a wrong-server connection.
  - `scripts/e2e-server.ts` (out of batch scope — minimal change documented here): Added `access()` pre-flight check at startup that prints a clear "run `bun run build` first" message and exits 1 if `.output/server/index.mjs` is missing.
