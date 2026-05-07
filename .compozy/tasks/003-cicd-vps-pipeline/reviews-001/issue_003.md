---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: .github/workflows/cd.yml
line: 36
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Implementation requires 5 secrets; PRD success metric says ≤ 4

## Review Comment

The PRD success metric states: *"GitHub Secrets required for setup: ≤ 4 — VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT."*

The TechSpec and implementation require a fifth secret: `VPS_DEPLOY_PATH` (line 40 of `cd.yml`). The PRD's first-time setup flow also lists only 4 secrets without mentioning `VPS_DEPLOY_PATH`.

Adding `VPS_DEPLOY_PATH` as a secret is reasonable — it makes the deploy path configurable without hardcoding. But the deviation from the PRD metric is undocumented: neither the TechSpec nor an ADR records the trade-off or updates the success criterion.

**Fix** (either option):

1. **Hardcode a conventional path** in `scripts/deploy.sh` (e.g., `${DEPLOY_PATH:-/home/deploy/blog}`) so the secret is optional and the 4-secret limit is preserved. The operator documents the path convention rather than configuring it via a secret.

2. **Update the PRD success metric** to ≤ 5 with a note explaining why `VPS_DEPLOY_PATH` was added. This preserves the current implementation without silent spec drift.

Option 2 is lower risk; option 1 saves the secret at the cost of a convention.

## Triage

- Decision: `valid`
- Notes: Confirmed. `cd.yml` line 40 passes `DEPLOY_PATH: ${{ secrets.VPS_DEPLOY_PATH }}`, a fifth secret not listed in the PRD success metric (≤ 4). Taking option 2 (lower risk): update the PRD success metric row to ≤ 5 with a note, preserving the current implementation and all existing tests. This avoids changing deploy.sh behavior (which would break the "exits non-zero when DEPLOY_PATH unset" test).
