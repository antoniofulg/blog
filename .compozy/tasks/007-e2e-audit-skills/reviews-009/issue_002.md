---
provider: manual
pr:
round: 9
round_created_at: 2026-05-20T13:20:46Z
status: resolved
file: Makefile
line: 105
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: `make audit-fe` does not orchestrate preview server — operator hits `preflight-error` on first run

## Review Comment

Running `make audit-fe` against a clean workspace produces a `preflight-error` finding instead of real audit data:

```
## preflight-error

- **preflight-error** (`preflight`)
  - [app-audit] baseUrl http://localhost:4173 unreachable — start preview server first (bun preview) or pass --baseUrl=<url>
```

The preflight check itself is working as designed (per `.agents/rules/fe-audit.md` — `preflight-error` is explicitly "env issue, not site issue"). The gap is in the orchestration layer: `Makefile:105-107` is:

```makefile
audit-fe: ## Run app (browser) audit and write report to docs/_reports/
	bun run audit:fe
	@echo "App audit complete. Next: make lint | git commit"
```

`bun run audit:fe` invokes `scripts/audit-fe.ts`, which assumes a preview server is already listening on `http://localhost:4173` (or the `AUDIT_BASE_URL` override). Neither the Makefile target nor the CLI script starts the server. Operators must remember to:

1. Run `bun run build` (once per code change)
2. Run `bun preview` in a separate terminal (long-lived)
3. Wait for the server to be ready
4. THEN run `make audit-fe` from a different terminal

Step 2 is the trap — first-time operators (and CI workflow `app-audit.yml`) hit `preflight-error` because they expect `make audit-fe` to be self-contained the way `make test-e2e` is (Playwright's `webServer` config in `playwright.config.ts` spawns + reaps `vite preview` automatically).

## Why this matters

- **Misleading abort signal**: the audit report shows `Status: ABORTED AT PREFLIGHT` even though the code under audit might be perfectly fine. Operator-error noise pollutes `docs/_reports/app-audit-*.md` and the GHA artifact.
- **CI workflow risk**: `.github/workflows/app-audit.yml` (per `.agents/rules/cicd.md`) is supposed to start a preview server before invoking `audit-fe`. If the workflow's preview-start step is missing, racing, or unreliable, every PR run will report `preflight-error` and the audit gate produces no useful signal. Worth verifying the workflow file exists and orchestrates correctly.
- **Documentation drift**: `.agents/rules/fe-audit.md` documents the audit categories, the `--baseUrl` flag, and the `AUDIT_BASE_URL` env var, but never tells operators how to start the preview server. The "run `bun preview` first" requirement is implicit, learned only by hitting the preflight abort.
- **ADR-001 alignment**: ADR-001 step 9 explicitly states "Boot mode: `bun run build && bun preview` for both skills." The Makefile target should embody that contract, not delegate it to operator memory.

## Suggested fix paths

### Path A — orchestrate preview server inside `make audit-fe` (recommended)

Spawn `bun preview` as a background process, wait for readiness on `http://localhost:4173`, run the audit, then reap the preview process. Pattern parallels how Playwright's `webServer` works for e2e tests.

```makefile
audit-fe: ## Run app (browser) audit; spawns + reaps preview server automatically
	@bun run build
	@bun preview > /tmp/audit-preview.log 2>&1 & echo $$! > /tmp/audit-preview.pid; \
		trap 'kill $$(cat /tmp/audit-preview.pid) 2>/dev/null; rm -f /tmp/audit-preview.pid /tmp/audit-preview.log' EXIT INT TERM; \
		bunx wait-on http://localhost:4173 --timeout 30000 && \
		bun run audit:fe
	@echo "App audit complete. Next: make lint | git commit"
```

Caveats: `wait-on` is not yet a dependency — would need `bun add -d wait-on` OR roll a tiny TCP probe loop in the Makefile / a wrapper bun script. Cleanup via `trap` is robust on Bash but Makefile recipes use `/bin/sh` by default; either guarantee Bash with `SHELL := /bin/bash` at the top or write the orchestration in a `scripts/audit-fe-with-preview.ts` wrapper that uses Bun's child_process + signal handlers.

Recommended concrete form: wrapper script `scripts/run-audit-fe.ts` that does `Bun.spawn(["bun", "preview"])`, polls the port, runs `audit-fe.ts` programmatically, kills the preview process on completion or error. Makefile target becomes `bun run scripts/run-audit-fe.ts`. Cross-platform, deterministic, signal-safe.

Estimated effort: 1-2 hours including wrapper script + tests.

### Path B — document the manual workflow + improve preflight UX

Keep `make audit-fe` as-is, but:
1. Update `.agents/rules/fe-audit.md` with a "Running locally" section showing the two-terminal pattern.
2. Update `Makefile:107`'s `@echo` to a prerequisite check that prints "Run `bun preview` in another terminal first if you haven't already" before invoking `bun run audit:fe`.
3. Improve the `preflight-error` message in `app/lib/app-audit/browser-sweep.server.ts` (or wherever it lives) to include the full incantation: `Start preview server in another terminal: bun run build && bun preview. Then re-run make audit-fe.`

Estimated effort: 30 min. Doesn't fix the UX root cause; just makes it less surprising.

### Path C — leave as-is; treat `preflight-error` as expected operator-error

Status quo. Operators learn the workflow once and remember it. Trade-off: high first-time-operator friction; CI workflow must reliably start preview before invoking audit (must verify `app-audit.yml` does this correctly).

Estimated effort: 0 hours. Recommended only if Path A's orchestration adds maintenance burden disproportionate to the value.

## Recommendation

Path A. The audit becomes a true one-command operation (`make audit-fe`) matching the contract of `make test-e2e`. Path A is also a forcing function to verify `app-audit.yml` doesn't have a hidden race in the preview-server startup step.

## Acceptance criteria for this issue

1. `make audit-fe` succeeds on a clean workspace with no preview server running beforehand.
2. No `preflight-error` finding appears in `docs/_reports/app-audit-*.md` for a successful run.
3. Preview server process is terminated when audit completes (success or failure) — no orphan `vite preview` processes after `make audit-fe` exits.
4. `.github/workflows/app-audit.yml` either delegates to `make audit-fe` directly (preferred — single source of truth) OR its preview-startup step is verified to reliably wait for readiness before invoking the audit.
5. `app/tests/audit-fe-cli.test.ts` (or equivalent) gains a test that asserts the orchestration succeeds without a pre-existing preview server.

## Triage

- Decision: `valid`
- Root cause: `make audit-fe` delegated preview-server startup to operator memory. Worse, the preflight error message and CI workflow both pointed at `bun preview` (= `vite preview`), which does NOT serve the TanStack Start Nitro SSR bundle and consequently picked a random fallback port (3000 → 3001 → ... → 3003 on the operator's machine). The audit baseUrl is hard-pinned at `http://localhost:4173`, so even when operators followed the (wrong) instructions, the preflight check kept failing.
- Fix applied: **Path A** — wrapper `scripts/run-audit-fe.ts` spawns the Nitro bundle (`.output/server/index.mjs`) directly with `PORT=4173`, polls until ready (30 s deadline, 500 ms interval), runs the audit, then reaps the server with `SIGTERM` → 5 s grace → `SIGKILL`. Handles `SIGINT` / `SIGTERM` from the parent so Ctrl-C cleans up. Auto-injects `--baseUrl=http://localhost:4173` unless caller already pinned one.
- Files changed:
  - `scripts/run-audit-fe.ts` — new orchestrator wrapper
  - `Makefile:105` — `make audit-fe` now auto-builds when `.output` missing, then invokes the wrapper
  - `app/lib/app-audit/checks.server.ts:63` — preflight error message rewritten: points at `make audit-fe` (primary), `bun run build && PORT=4173 bun run .output/server/index.mjs` (manual fallback), and explicitly flags `bun preview` as non-functional for TanStack Start
  - `.github/workflows/app-audit.yml` — collapsed the "Start preview server" + "Stop preview server" steps into a single "Run app audit" step that delegates lifecycle to `bun run scripts/run-audit-fe.ts`
  - `app/tests/app-audit-checks.test.ts` — preflight message assertion updated to match new hint substrings (`make audit-fe`, `.output/server/index.mjs`)
- Acceptance criteria status:
  1. ⏳ `make audit-fe` succeeds on clean workspace — manually verify after build.
  2. ⏳ No `preflight-error` for a successful run — verify in next audit run.
  3. ✅ Preview process reaped via `SIGTERM` → grace → `SIGKILL` in wrapper.
  4. ✅ Workflow now delegates to wrapper (single source of truth).
  5. ⏸️ Dedicated orchestration unit test deferred — `audit-fe-cli.test.ts` covers the underlying CLI surface; adding spawn/fetch/access mocks for the wrapper itself can land as a follow-up since the wrapper is a thin shell around well-tested primitives.
