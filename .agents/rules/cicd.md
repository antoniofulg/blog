# CI/CD Pipeline Rules

## Overview

Two GitHub Actions workflows handle all automation. No manual deploy steps exist for normal work.

```
ci.yml   — quality gate, triggers on every push and PR
cd.yml   — deploy pipeline, triggers after ci.yml passes on main only
```

## CI workflow (ci.yml)

Triggers: every `git push` (any branch) and every PR targeting `main`.

Six quality checks run in parallel:

| Job | Command | Blocks merge if fails |
|-----|---------|----------------------|
| quality (test) | `make test` | yes |
| quality (lint) | `make lint` | yes |
| quality (check) | `make check` (tsc --noEmit) | yes |
| quality (build-js) | `make build-js` | yes |
| quality (e2e) | `make test-e2e` (Playwright) | yes |
| quality (lint-tests) | `make lint-tests` | yes |

Two additional jobs run on PRs only:

| Job | What it checks |
|-----|----------------|
| commitlint | All commits in PR follow Conventional Commits |
| branch-check | Branch name matches `<feat\|fix\|chore\|docs\|test\|refactor\|ci\|hotfix>/<slug>` or `post/<lang>/<slug>` |

All eight checks must be green before a PR can merge.

### E2E gate behavior

The `e2e` matrix entry:
- Restores Chromium from cache (key: `playwright-<os>-<bun.lock-hash>`); on the first run it installs and populates the cache, subsequent runs skip the download.
- Runs `bun run build` (required by `playwright.config.ts` which starts a `vite preview` server).
- Runs `bunx playwright test` via `make test-e2e`.
- Uploads `playwright-report/` and `test-results/` as a GHA artifact (7-day retention) regardless of pass/fail.

## CD workflow (cd.yml)

Triggers: `workflow_run` on CI completion with `conclusion == 'success'` for pushes to `main` only. CD never fires if CI failed or was cancelled.

Two jobs run in sequence (deploy needs build-push):

1. **build-push** — builds Docker image (`target: runner` from multi-stage Dockerfile), tags with `:latest` and `:<short-sha>`, pushes to GHCR
2. **deploy** — `scp`s `docker-compose.prod.yml` → `$DEPLOY_PATH/docker-compose.yml` on the VPS, SSHes in, brings up `db` and waits healthy, runs `bun run db:migrate`, then `bun run sync`, then `docker compose up -d --no-deps app`. The compose file on the VPS is **CD-managed** — hand-edits get overwritten on the next deploy.

Migration runs before container restart — this ordering is non-negotiable. If `make db-migrate` fails, the deploy aborts and the VPS keeps serving the previous container.

## Merge to main: what actually happens

```
PR merged → push to main
  → ci.yml fires on merge commit
  → ci.yml passes
  → cd.yml fires (workflow_run gate)
      → build-push: image at ghcr.io/<owner>/blog:<sha> and :latest
      → deploy: VPS pulls :latest, runs migrations, runs content sync, restarts app
  → blog live at new version (~5 min total)
```

## GHCR image strategy

Images are tagged with two tags per build (ADR-003):
- `:latest` — VPS always pulls this; points to most recent main build
- `:<short-sha>` — immutable, traceable to exact commit; use for rollback

Rollback without rebuild: `docker tag ghcr.io/<owner>/blog:<old-sha> ghcr.io/<owner>/blog:latest && docker push ghcr.io/<owner>/blog:latest` on the VPS.

GHCR package is set to **public** — VPS pulls without credentials. Production secrets (DATABASE_URL, etc.) are never in the image; they come from `.env` at runtime.

## GitHub Secrets required (one-time setup)

### Deploy secrets

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | Deploy user (must be in `docker` group) |
| `VPS_SSH_KEY` | Ed25519 private key (full PEM including header/footer) |
| `VPS_PORT` | SSH port (usually 22) |
| `VPS_DEPLOY_PATH` | Absolute path to project on VPS (e.g. `/home/deploy/blog`) |

### E2E secrets

| Secret | Value |
|--------|-------|
| `E2E_ADMIN_EMAIL` | Email of the admin user used for Playwright login tests |
| `E2E_ADMIN_PASSWORD` | Password of the admin user used for Playwright login tests |

**One-time setup**: Go to the GitHub repository → Settings → Secrets and variables → Actions → New repository secret. Add `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` with the credentials of a seeded admin account. These values must match what is seeded in the test database via `global-setup.ts`. The secrets are read by the `e2e` matrix entry and passed to the test process via environment variables.

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

## App Audit workflow (app-audit.yml)

Informational-only gate — does NOT block merges.

Triggers:
- `workflow_dispatch` — manual run; exposes `lighthouse` input (type: choice, default `"false"`, options `["false", "true"]`)
- `pull_request.paths` — fires when any of these change: `app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`

### lighthouse input

The `lighthouse` input controls whether `@lhci/cli` runs Lighthouse probes:
- Default `"false"` — skips Lighthouse categories (`seo-score-drop`, `perf-budget-breach`, `best-practices-fail`); avoids ±10-point score variance on shared runners
- `"true"` — enables all 12 categories including Lighthouse; use for explicit perf/SEO investigation

Workflow step: `if: ${{ inputs.lighthouse == 'true' }}` (literal string equality).

### Secrets required

No new GitHub Secrets. App-audit reuses Phase 1 E2E secrets if admin routes are walked:
- `E2E_ADMIN_EMAIL` — already required for e2e-coverage Playwright suite
- `E2E_ADMIN_PASSWORD` — already required for e2e-coverage Playwright suite

### Gate behavior

- Workflow uploads `docs/_reports/app-audit-*.md` as a GHA artifact (7-day retention) regardless of pass/fail.
- PR comment posted via `peter-evans/create-or-update-comment@v4` using `body-includes: "<!-- audit-fingerprint:app:"` — delta-suppressed when blocker + major counts unchanged from previous comment on same PR.
- Exit code 1 from `bun run audit:fe` causes the audit step to fail; workflow continues to post comment and upload artifact (`set +e` before the command).

### Fork PR behavior

The workflow uses `pull_request` (not `pull_request_target`), so fork PRs run **without secrets** — the admin fixture auth walk fails at the seed step, and only public-route findings are collected. The PR comment step is guarded by `github.event.pull_request.head.repo.full_name == github.repository`, so comments are only posted for PRs from branches within this repository. Artifact upload and the audit run itself are unaffected on fork PRs.

## What agents must not do

- Never push directly to `main` for feature work — always via PR
- Never skip CI checks with `git push --force` to main
- Never hardcode secrets in workflow files — all credentials go in GitHub Secrets
