---
status: completed
title: "VPS deploy script — scripts/deploy.sh"
type: infra
complexity: low
dependencies: []
---

# Task 02: VPS deploy script — scripts/deploy.sh

## Overview

Creates `scripts/deploy.sh`, the SSH deploy script that both GitHub Actions CD (task_04) and `make deploy` call. It pulls the latest Docker image from GHCR, runs database migrations, and restarts the app container on the VPS. Creating this file activates the existing `make deploy` stub automatically — no Makefile changes are needed.

<critical>
- ALWAYS READ the PRD (F2, F6) and TechSpec "Core Interfaces" section before starting
- REFERENCE TECHSPEC for the exact env var names, SSH flags, and command sequence
- FOCUS ON "WHAT" — the script must pull, migrate, and restart in that fixed order; migration failure MUST abort before container restart
- MINIMIZE CODE — fewer than 25 lines; all complexity is in the VPS environment setup (task_05)
- TESTS REQUIRED — verify the script's structure, required env var validation, and error behavior
</critical>

<requirements>
- MUST use `#!/usr/bin/env bash` shebang and `set -euo pipefail` for fail-fast behavior
- MUST validate all required env vars (`VPS_USER`, `VPS_HOST`, `DEPLOY_PATH`, `GHCR_OWNER`, `GHCR_REPO`) with `:?` parameter expansion before the SSH call
- MUST use `StrictHostKeyChecking=accept-new` in the SSH flags so the first connection accepts the host key without manual intervention
- MUST execute steps in this exact order inside the SSH session: (1) `docker pull`, (2) `make db-migrate`, (3) `docker compose up -d --no-deps app`
- MUST be set executable (`chmod +x scripts/deploy.sh`) — Git must track the executable bit
- MUST use `$VPS_PORT` with a default of `22` if not set (`VPS_PORT="${VPS_PORT:-22}"`)
- MUST NOT hardcode any hostname, username, image name, or path
- SHOULD emit a `[deploy]` prefixed log line at the start and on completion for observability
</requirements>

## Subtasks

- [x] 2.1 Create `scripts/deploy.sh` with shebang, `set -euo pipefail`, env var validation, and SSH command sequence
- [x] 2.2 Run `chmod +x scripts/deploy.sh` and confirm Git tracks the executable bit (`git ls-files --stage scripts/deploy.sh` shows mode `100755`)
- [x] 2.3 Verify `bash -n scripts/deploy.sh` exits 0 (no syntax errors)
- [x] 2.4 Verify `make deploy` now shows "executing" output instead of "No deploy script found" when the script is present

## Implementation Details

See TechSpec "Core Interfaces" section for the exact script content, including all env var names and SSH flag choices.

The SSH session runs three commands as a single string argument. They are separated by `&&` so any failure stops the chain before the next step starts — this is the migration-first guarantee (PRD F6).

The `StrictHostKeyChecking=accept-new` flag accepts new host keys silently but rejects changed keys, balancing automation with basic MITM protection.

### Relevant Files

- `scripts/deploy.sh` — new file; must be executable
- `Makefile` — `make deploy` target checks for `scripts/deploy.sh` and calls `bash scripts/deploy.sh`; this task satisfies the check automatically, no Makefile edit needed

### Dependent Files

- `.github/workflows/cd.yml` (task_04) — the deploy job calls `bash scripts/deploy.sh` after injecting the required env vars from GitHub Secrets

### Related ADRs

- [ADR-001: CI/CD V1 Scope](../adrs/adr-001.md) — migration-first deploy sequence (F6) is a required V1 behavior
- [ADR-002: Pipeline Architecture](../adrs/adr-002.md) — `scripts/deploy.sh` is the shared interface for both CI and `make deploy`

## Deliverables

- `scripts/deploy.sh` with `755` permissions tracked by Git
- Syntax verification (`bash -n`) passing
- Confirmation that `make deploy` activates with the script present

## Tests

- Unit tests:
  - [x] `bash -n scripts/deploy.sh` exits 0 (syntax check)
  - [x] Running `VPS_USER=u VPS_HOST=h DEPLOY_PATH=/p GHCR_OWNER=o GHCR_REPO=r bash scripts/deploy.sh` with a stubbed SSH command that echoes args — verify the SSH command includes `-p 22` (default port), `StrictHostKeyChecking=accept-new`, and the three commands in the correct order
  - [x] Running without `VPS_USER` set exits non-zero with an error referencing the missing variable
  - [x] Running without `DEPLOY_PATH` set exits non-zero with an error referencing the missing variable
  - [x] `git ls-files --stage scripts/deploy.sh` shows mode `100755`
- Integration tests:
  - [x] `make deploy` with the script present executes `bash scripts/deploy.sh` (not the "no script found" message)
  - [x] `bash scripts/deploy.sh` without env vars exits non-zero with clear error (Makefile doesn't propagate failure due to `;` vs `&&` — see task memory)
- Test coverage target: N/A (shell script; validation is behavioral)
- All tests must pass

## Success Criteria

- `scripts/deploy.sh` exists, is executable, and passes `bash -n` syntax check
- `make deploy` no longer shows "No deploy script found"
- All required env vars produce a clear error if unset
- Git tracks the executable bit (mode `100755`)
