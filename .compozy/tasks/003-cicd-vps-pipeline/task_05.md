---
status: completed
title: "Repository configuration — Secrets, Ruleset, GHCR visibility"
type: infra
complexity: low
dependencies:
    - task_04
---

# Task 05: Repository configuration — Secrets, Ruleset, GHCR visibility

## Overview

Configures the GitHub repository settings and VPS environment that the CI/CD workflows require to run end-to-end. This is the final activation step: after this task, every push to `main` deploys automatically and every non-TASK branch is blocked at creation. No code is written — this task is entirely UI and server configuration.

<critical>
- ALWAYS READ the PRD and TechSpec "Integration Points" and "Data Models" sections before starting
- REFERENCE TECHSPEC "Technical Dependencies" section for the complete VPS prerequisite checklist
- FOCUS ON "WHAT" — configure five GitHub Secrets, one GitHub Ruleset, and two GitHub UI settings; verify each one works
- MINIMIZE CODE — no code changes; all work is in GitHub Settings UI and VPS terminal
- TESTS REQUIRED — smoke test each configuration item before marking done
</critical>

<requirements>
- MUST configure five GitHub Secrets in the repository Settings → Secrets and variables → Actions: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `VPS_DEPLOY_PATH`
- `VPS_SSH_KEY` MUST contain the complete Ed25519 private key including the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` header/footer lines
- The deploy user on the VPS MUST be in the `docker` group so `docker compose` runs without `sudo`
- The VPS MUST have the blog project checked out at `$VPS_DEPLOY_PATH` with `docker-compose.yml` and `.env` present before the first deploy
- MUST create a GitHub Ruleset via Settings → Rules → Rulesets with: branch target = all branches except `main`, rule type = "Restrict branch names", regex = `^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$`
- MUST set the GHCR package visibility to **public** after the first successful CD run pushes an image: navigate to `github.com/{owner}/packages/container/{repo}/settings` → "Change package visibility" → Public
- SHOULD add the VPS public key to `~/.ssh/authorized_keys` for the deploy user using `ssh-copy-id` or manual append
- SHOULD verify the end-to-end smoke test sequence from the TechSpec "Testing Approach / Smoke test sequence" section
</requirements>

## Subtasks

- [ ] 5.1 Generate an Ed25519 SSH key pair (`ssh-keygen -t ed25519 -C "github-actions-deploy"`) and add the public key to VPS `~/.ssh/authorized_keys` for the deploy user
- [ ] 5.2 Configure five GitHub Secrets in repository Settings with the VPS credentials
- [ ] 5.3 Verify the VPS deploy user is in the `docker` group (`groups $VPS_USER` should include `docker`)
- [ ] 5.4 Ensure the blog project is checked out on the VPS at `$VPS_DEPLOY_PATH` with `.env` and `docker-compose.yml` present
- [ ] 5.5 Create the GitHub Ruleset for branch naming with the TASK-prefix regex
- [ ] 5.6 Trigger the first full CD run by pushing a `feat:` commit to `main`; confirm image in GHCR, blog loads on VPS, `CHANGELOG.md` appears
- [ ] 5.7 Set the GHCR package to public visibility after the first image appears
- [ ] 5.8 Run the full smoke test sequence from the TechSpec to verify all five workflows work end-to-end

## Implementation Details

See TechSpec "Integration Points" section for SSH key setup details, GHCR visibility instructions, and Lefthook hook registration notes.

**VPS prerequisite checklist (all must be true before the first CD deploy succeeds):**
- Deploy user exists: `id $VPS_USER`
- Deploy user in docker group: `groups $VPS_USER | grep docker`
- Docker and Docker Compose installed: `docker compose version`
- Project directory exists: `ls $VPS_DEPLOY_PATH/docker-compose.yml`
- `.env` file present at deploy path with correct `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Postgres container running: `docker compose -f $VPS_DEPLOY_PATH/docker-compose.yml ps db`

**GitHub Ruleset regex to enter verbatim:**
```
^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$
```

### Relevant Files

- `scripts/deploy.sh` — the script called by every CD deploy; VPS must satisfy all its env var requirements
- `.github/workflows/cd.yml` — consumes the five GitHub Secrets configured in this task
- `.github/workflows/ci.yml` — the `branch-check` job validates the regex; the Ruleset is the enforcement layer at push time

### Dependent Files

- `CHANGELOG.md` — created by task_04 on first successful CD run after this task's secrets are configured
- VPS `.env` — not in the repository; must be created manually on the VPS at `$VPS_DEPLOY_PATH/.env`

### Related ADRs

- [ADR-001: CI/CD V1 Scope](../adrs/adr-001.md) — GitHub Secrets and Ruleset are required V1 components
- [ADR-003: GHCR Image Tagging](../adrs/adr-003.md) — GHCR package visibility must be public after the first build

## Deliverables

- Five GitHub Secrets configured and visible (names only, not values) in repository Settings
- GitHub Ruleset active for all branches except `main`
- GHCR package set to public visibility
- VPS deploy user confirmed in docker group
- First end-to-end deploy completed successfully
- `CHANGELOG.md` present in the repository root

## Tests

- Unit tests (configuration verification):
  - [ ] `ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "echo ok"` from the local machine with the deploy key succeeds
  - [ ] `ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "docker compose version"` succeeds (docker group membership confirmed)
  - [ ] `ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "ls $VPS_DEPLOY_PATH/.env"` exits 0 (`.env` present on VPS)
  - [ ] Attempting to create `git push origin feature/bad-branch` is blocked by the GitHub Ruleset with a descriptive error
  - [ ] Attempting `git push origin TASK-0005/repo-config` succeeds (conforming branch allowed)
- Integration tests (end-to-end smoke test):
  - [ ] Pushing a `feat:` commit to `main` → GitHub Actions shows all three CD jobs green
  - [ ] Docker image with `:latest` tag visible at `github.com/{owner}/packages/container/{repo}`
  - [ ] Blog loads on VPS URL with the new code within 5 minutes of push
  - [ ] `CHANGELOG.md` contains the `feat:` entry grouped under the current date
  - [ ] A second push with only a `chore:` commit → `CHANGELOG.md` does NOT change (no unnecessary commit)
- Test coverage target: N/A (configuration task; validation is behavioral)
- All tests must pass

## Success Criteria

- Five GitHub Secrets configured with correct values (verified by a successful CD run)
- GitHub Ruleset blocks non-TASK branch creation at the push level
- GHCR package is publicly readable without authentication
- `make deploy` with correct env vars set locally performs the same steps as the CD workflow
- Full smoke test sequence from the TechSpec passes without intervention
