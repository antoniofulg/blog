---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: app/tests/deploy-sh.test.ts
line: 102
severity: low
author: claude-code
provider_ref:
---

# Issue 005: Missing required-var failure tests for VPS_HOST, GHCR_OWNER, GHCR_REPO

## Review Comment

`deploy-sh.test.ts` tests that the script exits non-zero and prints the var name when `VPS_USER` and `DEPLOY_PATH` are unset. Three other required vars — `VPS_HOST`, `GHCR_OWNER`, and `GHCR_REPO` — have identical `${VAR:?}` guards in `deploy.sh` but no corresponding test cases:

```bash
: "${VPS_HOST:?VPS_HOST env var required}"   # line 5 of deploy.sh — untested
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:latest"  # lines 8 — untested
```

If a future change accidentally removes or misspells one of these guards, no test will catch the regression.

**Fix**: Add three test cases following the existing pattern:

```typescript
it("exits non-zero and references VPS_HOST when unset", () => { ... });
it("exits non-zero and references GHCR_OWNER when unset", () => { ... });
it("exits non-zero and references GHCR_REPO when unset", () => { ... });
```

## Triage

- Decision: `valid`
- Notes: Confirmed in `deploy-sh.test.ts`. Tests exist for VPS_USER (line 102) and DEPLOY_PATH (line 117) unset cases. VPS_HOST (deploy.sh line 5), GHCR_OWNER and GHCR_REPO (deploy.sh line 8 via `${VAR:?}`) have identical guards but no tests. Fix: add three test cases following the existing `spawnSync` + destructure pattern.
