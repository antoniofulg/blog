# CI/CD Pipeline Rules

## Overview

Two GitHub Actions workflows handle all automation. No manual deploy steps exist for normal work.

```
ci.yml   — quality gate, triggers on every push and PR
cd.yml   — deploy pipeline, triggers after ci.yml passes on main only
```

## CI workflow (ci.yml)

Triggers: every `git push` (any branch) and every PR targeting `main`.

Three jobs run in parallel:

| Job | Command | Blocks merge if fails |
|-----|---------|----------------------|
| quality (test) | `make test` | yes |
| quality (lint) | `make lint` | yes |
| quality (check) | `make check` (tsc --noEmit) | yes |

Two additional jobs run on PRs only:

| Job | What it checks |
|-----|----------------|
| commitlint | All commits in PR follow Conventional Commits |
| branch-check | Branch name matches `TASK-XXXX/slug` or `hotfix/*` |

All five checks must be green before a PR can merge.

## CD workflow (cd.yml)

Triggers: `workflow_run` on CI completion with `conclusion == 'success'` for pushes to `main` only. CD never fires if CI failed or was cancelled.

Three jobs run in sequence (each needs the previous):

1. **build-push** — builds Docker image (`target: runner` from multi-stage Dockerfile), tags with `:latest` and `:<short-sha>`, pushes to GHCR
2. **deploy** — SSHes into VPS, runs `make db-migrate` first, then `docker compose up -d --no-deps app`
3. **changelog** — runs `conventional-changelog-cli`, commits updated `CHANGELOG.md` back to `main` with `[skip ci]`

Migration runs before container restart — this ordering is non-negotiable. If `make db-migrate` fails, the deploy aborts and the VPS keeps serving the previous container.

## Merge to main: what actually happens

```
PR merged → push to main
  → ci.yml fires on merge commit
  → ci.yml passes
  → cd.yml fires (workflow_run gate)
      → build-push: image at ghcr.io/<owner>/blog:<sha> and :latest
      → deploy: VPS pulls :latest, runs migrations, restarts app
      → changelog: CHANGELOG.md updated, committed with [skip ci]
  → blog live at new version (~5 min total)
```

## GHCR image strategy

Images are tagged with two tags per build (ADR-003):
- `:latest` — VPS always pulls this; points to most recent main build
- `:<short-sha>` — immutable, traceable to exact commit; use for rollback

Rollback without rebuild: `docker tag ghcr.io/<owner>/blog:<old-sha> ghcr.io/<owner>/blog:latest && docker push ghcr.io/<owner>/blog:latest` on the VPS.

GHCR package is set to **public** — VPS pulls without credentials. Production secrets (DATABASE_URL, etc.) are never in the image; they come from `.env` at runtime.

## GitHub Secrets required (one-time setup)

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | Deploy user (must be in `docker` group) |
| `VPS_SSH_KEY` | Ed25519 private key (full PEM including header/footer) |
| `VPS_PORT` | SSH port (usually 22) |
| `VPS_DEPLOY_PATH` | Absolute path to project on VPS (e.g. `/home/deploy/blog`) |

## Manual deploy fallback

If GitHub Actions is unavailable, deploy.sh accepts the same env vars:

```sh
export VPS_USER=deploy
export VPS_HOST=<ip>
export VPS_PORT=22
export DEPLOY_PATH=/home/deploy/blog
export GHCR_OWNER=<owner>
export GHCR_REPO=blog
bash scripts/deploy.sh
# or: make deploy
```

## Emergency hotfix

```sh
git checkout -b hotfix/description    # Ruleset exempts hotfix/* branches
# make fix
git commit -m "fix(area): description" --no-verify   # --no-verify if under pressure
git push origin hotfix/description
# merge PR or push directly to main
```

CD fires within 5 minutes. `--no-verify` bypasses the local commit-msg hook — the bypass is visible in CI commitlint on the PR. Document retroactively with a compozy task.

## What agents must not do

- Never push directly to `main` for feature work — always via PR
- Never skip CI checks with `git push --force` to main
- Never add `[skip ci]` to non-changelog commits — that token is reserved for the automated changelog bot commit
- Never hardcode secrets in workflow files — all credentials go in GitHub Secrets
