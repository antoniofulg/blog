---
status: completed
title: "CD deploy pipeline — .github/workflows/cd.yml"
type: infra
complexity: medium
dependencies:
  - task_02
  - task_03
---

# Task 04: CD deploy pipeline — .github/workflows/cd.yml

## Overview

Creates the GitHub Actions CD workflow that fires on every push to `main`. Three sequential jobs build the production Docker image and push it to GHCR, SSH-deploy to the VPS via `scripts/deploy.sh`, and auto-update `CHANGELOG.md` from structured commit history. This implements PRD F2, F5, and F6 end-to-end.

<critical>
- ALWAYS READ the PRD (F2, F5, F6) and TechSpec "Core Interfaces" section before starting
- REFERENCE TECHSPEC for the exact job structure, tag strategy, SSH setup, and changelog command
- FOCUS ON "WHAT" — three jobs run in sequence; each job only starts if the previous succeeded
- MINIMIZE CODE — the workflow delegates to existing tools (Docker buildx, scripts/deploy.sh, conventional-changelog-cli); no logic in YAML
- TESTS REQUIRED — validate the tag format, changelog output, and that the workflow file is syntactically correct
</critical>

<requirements>
- MUST trigger only on `push` to `main` (not on PRs or other branches)
- MUST use three separate jobs: `build-push`, `deploy`, `changelog` — each using `needs:` to enforce sequential execution
- MUST authenticate to GHCR using `docker/login-action@v3` with `registry: ghcr.io` and `password: ${{ secrets.GITHUB_TOKEN }}`
- MUST push the image with TWO tags: `ghcr.io/${{ github.repository }}:latest` and `ghcr.io/${{ github.repository }}:${{ github.sha }}`
- MUST use `docker/build-push-action@v6` with `target: runner` to build only the production stage
- MUST use `webfactory/ssh-agent@v0.9.0` to inject the SSH private key from `secrets.VPS_SSH_KEY`
- MUST pass all five deploy env vars (`VPS_USER`, `VPS_HOST`, `VPS_PORT`, `DEPLOY_PATH`, `GHCR_OWNER`, `GHCR_REPO`) from GitHub Secrets to the `deploy` job before calling `bash scripts/deploy.sh`
- MUST run `conventional-changelog-cli -p angular -i CHANGELOG.md -s -r 0` to generate the changelog
- MUST commit the updated `CHANGELOG.md` with message `chore: update changelog [skip ci]` using `github-actions[bot]` as the Git identity
- MUST only push the changelog commit if `CHANGELOG.md` actually changed (`git diff --staged --quiet || ...` pattern)
- MUST set `permissions: contents: write` on the `changelog` job
- MUST set `permissions: contents: read, packages: write` on the `build-push` job
- MUST NOT use `GITHUB_TOKEN` for the SSH key — the SSH key comes from `secrets.VPS_SSH_KEY`
</requirements>

## Subtasks

- [x] 4.1 Create `.github/workflows/cd.yml` with correct trigger and three-job skeleton
- [x] 4.2 Implement `build-push` job: checkout, GHCR login, `docker/build-push-action` with dual tags
- [x] 4.3 Implement `deploy` job: `webfactory/ssh-agent`, env var injection, `bash scripts/deploy.sh`
- [x] 4.4 Implement `changelog` job: checkout with `fetch-depth: 0`, `bun install`, `conventional-changelog-cli`, conditional commit and push
- [x] 4.5 Validate YAML syntax locally before pushing
- [ ] 4.6 Trigger the pipeline end-to-end by merging a `feat:` or `fix:` commit to `main` and verify: image appears in GHCR, VPS serves updated app, `CHANGELOG.md` gains an entry

## Implementation Details

See TechSpec "Core Interfaces" section (`cd.yml` abbreviated structure) for the exact job shapes, permissions, and step order.

Key implementation points:
- `github.sha` in the image tag uses the full 40-char SHA; acceptable for traceability
- `build-push-action` with `push: true` pushes both tags atomically
- The changelog job uses `fetch-depth: 0` so `conventional-changelog-cli` can walk the full commit history
- The `[skip ci]` token in the changelog commit prevents a recursive CD trigger (GitHub Actions skips runs with this token in the commit message)
- `github-actions[bot]` email is `github-actions[bot]@users.noreply.github.com`

### Relevant Files

- `.github/workflows/cd.yml` — new file to create
- `scripts/deploy.sh` (task_02) — the deploy job calls this; must exist before CD can run
- `Dockerfile` — `target: runner` references the third build stage; structure already confirmed
- `docker-compose.yml` — `docker compose up -d --no-deps app` is called inside `scripts/deploy.sh` on the VPS

### Dependent Files

- `CHANGELOG.md` — created automatically by the `changelog` job on first successful CD run; do not create manually
- GitHub Secrets (task_05) — `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_DEPLOY_PATH` must be configured before the deploy job can succeed

### Related ADRs

- [ADR-002: Pipeline Architecture](../adrs/adr-002.md) — `cd.yml` is one of the two workflow files; three-job sequential structure chosen
- [ADR-003: GHCR Image Tagging — Git SHA + latest](../adrs/adr-003.md) — dual-tag strategy is a requirement of this task

## Deliverables

- `.github/workflows/cd.yml` with three sequential jobs
- A Docker image visible in `github.com/{owner}/packages/container/blog` after the first successful run
- `CHANGELOG.md` created in the repository root after the first `feat:` or `fix:` commit reaches `main`

## Tests

- Unit tests (local validation before push):
  - [x] YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cd.yml'))"` exits 0
  - [ ] The `changelog` job's git command produces a commit only when `CHANGELOG.md` changed — verify the `git diff --staged --quiet` guard logic by dry-running against a temp branch
  - [ ] `conventional-changelog-cli -p angular -i /tmp/CHANGELOG.md -s -r 0` on a repo with `feat:` and `fix:` commits produces entries for both types and omits `chore:` entries
- Integration tests:
  - [ ] After merging a PR with a `feat:` commit to `main` — Docker image with both `:latest` and `:{sha}` tags appears in GHCR packages
  - [ ] After the first CD run — the blog loads on the VPS URL with the new code
  - [ ] After the changelog job — `CHANGELOG.md` contains the `feat:` commit message under the current date
  - [ ] Pushing a second `chore:` commit to `main` — `CHANGELOG.md` does NOT gain a new entry (changelog job makes no commit)
  - [ ] If the `deploy` job fails (e.g., wrong VPS credentials) — the `changelog` job does NOT run (sequential `needs:` enforced)
- Test coverage target: N/A (CI/CD workflow; validation is behavioral)
- All tests must pass

## Success Criteria

- Merging any commit to `main` triggers the CD workflow automatically
- The Docker image appears in GHCR with both `:latest` and `:{sha}` tags after a successful build
- The VPS serves the updated blog within 5 minutes of the push
- `CHANGELOG.md` updates on every `main` merge that contains `feat:` or `fix:` commits
- The changelog commit does not trigger a recursive CD run
