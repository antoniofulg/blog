# PRD: CI/CD Pipeline + Branch & Commit Standards

## Overview

A production-ready CI/CD system that eliminates manual deployments by automatically testing, building, and deploying the blog to a VPS on every merge to `main`. Pairs the automation with enforced Conventional Commits and TASK-prefix branch naming so every code change is traceable from a compozy task to a live deploy. An auto-generated changelog surfaces the release history from structured commit messages without any manual writing effort.

**Who it is for:** The blog author (sole developer) who currently deploys by running Makefile commands manually, with no automated quality gate between a code change and a live production change.

**Why it is valuable:** Manual deploys are a tax on every code change — they require context switching, are skippable under time pressure, and leave no audit trail. Automated CI/CD removes that friction permanently and makes quality gates non-negotiable rather than optional.

---

## Goals

- Any push to `main` deploys the blog to the VPS in under 5 minutes with zero manual steps.
- No broken code reaches the VPS — CI blocks merges until all quality checks pass.
- The commit history is structured and machine-readable from the first commit, enabling auto-generated changelogs without retrofitting.
- Every branch is traceable to a compozy task via the TASK-prefix naming convention.
- The `CHANGELOG.md` updates automatically on every main merge with user-facing changes only.
- The full pipeline can be set up on a new repository with ≤ 4 GitHub Secrets configured.

---

## User Stories

### Developer (primary persona — sole author)

- As the developer, I want every push to any branch to run tests, linting, and type checks automatically so that I know immediately if my change is broken, without running `make test && make lint && make check` manually.
- As the developer, I want every merge to `main` to deploy the blog to the VPS automatically so that I can push a change and walk away without running any deploy command.
- As the developer, I want database migrations to run before the container restarts on every deploy so that the app never starts against a stale schema.
- As the developer, I want the TASK-prefix branch naming rule enforced automatically so that I can't accidentally create a branch that can't be traced to a task.
- As the developer, I want commitlint to block malformed commit messages before they leave my machine so that the changelog is always accurate and clean.
- As the developer, I want `CHANGELOG.md` to update automatically after every merge to `main` so I have a release history without writing it manually.
- As the developer returning after months away from the project, I want the full pipeline to be documented in the README and CONTRIBUTING so I can understand what runs when without reading YAML.

### Emergency persona

- As the developer dealing with a production incident, I want to create a `hotfix/` branch without a TASK prefix so that I can patch the live site immediately without ceremony.
- As the developer under pressure, I want `git commit --no-verify` documented as a known escape hatch so I can push a critical fix without being blocked by a commit-msg hook.

---

## Core Features

### F1 — CI Quality Gate (Critical)

A `ci.yml` workflow triggers on every push and pull request to any branch. It runs three checks in parallel:

- `make test` — Vitest test suite
- `make lint` — Biome linter
- `make check` — TypeScript type check (`tsc --noEmit`)

All three must pass before a pull request can be merged into `main`. Status checks appear on every PR and commit. The CI workflow runs on GitHub-hosted runners (no self-hosted infrastructure required).

### F2 — CD Deploy Pipeline (Critical)

A `cd.yml` workflow triggers on push to `main` only, after `ci.yml` passes. It executes in sequence:

1. Build the production Docker image (runner stage from existing multi-stage Dockerfile)
2. Push the image to GitHub Container Registry (GHCR) using the repository's `GITHUB_TOKEN`
3. SSH into the VPS using a deploy SSH key stored as a GitHub Secret
4. Run `make db-migrate` on the VPS to apply any pending schema migrations
5. Restart the app container with `docker compose up -d --no-deps app`

If any step fails, the pipeline stops immediately. The VPS continues running the previous container version — no partial state.

### F3 — Conventional Commits Enforcement (High)

Commit messages must follow the Conventional Commits format: `type(scope): description`. Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`.

Enforcement happens at two layers:

- **Local hook:** Lefthook `commit-msg` hook blocks the commit immediately if the message is non-conforming. Feedback is instant; no push required to discover the error.
- **CI check:** A workflow validates all commit messages in a pull request. This catches commits made with `--no-verify` before they merge.

The `--no-verify` escape hatch is documented in CONTRIBUTING for emergency use. Its use does not bypass the CI check on the PR.

### F4 — TASK-Prefix Branch Naming (High)

All branches except `main` and `hotfix/*` must follow the pattern `TASK-XXXX/short-description`, where `XXXX` is the zero-padded compozy task number (e.g., `TASK-0003/cicd-vps-pipeline`).

Enforcement:

- **GitHub Ruleset:** Native branch protection rule with a regex pattern blocks branch creation at the Git push level — no workflow needed.
- **CI check:** A workflow validates the branch name on every pull request open/update, providing a visible status check and error message if the pattern is not followed.

`hotfix/*` branches are exempt from the TASK-prefix requirement to allow emergency production patches without ceremony. `main` is always exempt.

### F5 — Auto-Changelog Generation (High)

After every successful merge to `main`, the CD pipeline appends to `CHANGELOG.md` using `conventional-changelog-cli`. Only `feat` and `fix` commits appear in the changelog — chore, docs, test, refactor, and ci commits are excluded.

The generated entry groups changes by type under the merge date. The updated `CHANGELOG.md` is committed back to `main` automatically using a bot commit with `[skip ci]` in the message to prevent a recursive pipeline trigger.

### F6 — Migration-First Deploy Sequence (Critical)

The deploy step in F2 is strictly ordered: migrations run first, container restart runs second. If `make db-migrate` exits non-zero, the CD pipeline aborts before touching the container. The VPS continues serving the previous app version with the previous schema — a predictable failure state rather than a broken one.

This ordering is non-negotiable: it prevents the app from starting against a schema that it doesn't understand.

---

## User Experience

### First-time setup flow (one-time, ≤ 15 minutes)

1. Configure 5 GitHub Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `VPS_DEPLOY_PATH`.
2. Push the workflow files (`.github/ci.yml`, `.github/cd.yml`) to `main`.
3. Verify that the first CD run completes and the blog loads on the VPS.
4. Enable the GitHub Ruleset for branch naming from the repository Settings UI.

After this, no further setup is needed. The pipeline runs on every subsequent push.

### Daily developer flow

1. Create a branch: `git checkout -b TASK-0004/my-feature` — branch name enforced at push.
2. Write code and commit: `git commit -m "feat(blog): add post list pagination"` — commit-msg hook validates instantly.
3. Push and open a PR — CI runs automatically, status appears on the PR within 2 minutes.
4. All checks green → merge to `main` — CD fires, VPS updated within 5 minutes.
5. Visit the blog — changes are live.

### Emergency hotfix flow

1. Create branch without TASK prefix: `git checkout -b hotfix/broken-login` — Ruleset exemption allows this.
2. Commit with `--no-verify` if needed: `git commit -m "emergency fix" --no-verify` — bypasses local hook.
3. Merge directly to `main` — CD fires, VPS updated within 5 minutes.
4. Retroactively create a compozy task for tracking if needed.

### Changelog discoverability

After every main merge, `CHANGELOG.md` at the repository root is updated automatically. The developer sees a chronological list of `feat` and `fix` entries grouped by release date. No manual writing required.

---

## High-Level Technical Constraints

- The pipeline must run exclusively on GitHub Actions with GitHub-hosted runners (no self-hosted infrastructure).
- Container images are stored in GHCR — the GitHub repository's built-in registry, authenticated via `GITHUB_TOKEN`. No third-party registry account is required.
- VPS access is via SSH key authentication only. The deploy user on the VPS must have permission to run Docker Compose commands without `sudo`.
- Database migrations (`make db-migrate`) must be idempotent — safe to run multiple times without side effects.
- The auto-changelog commit must include `[skip ci]` in its message to prevent a recursive pipeline trigger.
- The CD workflow must not start until `ci.yml` has successfully completed for the same commit.
- The `--no-verify` escape hatch must be documented in CONTRIBUTING but its use must remain visible via the CI commit-message check on the PR.

---

## Non-Goals (Out of Scope)

| Item | Reason |
|---|---|
| Staging or preview environment | Requires a second VPS or cloud service; disproportionate overhead for a personal blog |
| Zero-downtime deployment (docker-rollout) | `docker compose up -d --no-deps` restart time (<10s) is acceptable for a personal blog with no SLA |
| Manual approval gate before production deploy | Adds ceremony for a solo developer; CI gates already provide the confidence a manual click would add |
| Slack, email, or webhook deploy notifications | GitHub Actions UI provides deploy status at no additional setup cost |
| Auto-rollback on failed health check | V2 concern; requires HEALTHCHECK wiring and rollback logic before the VPS is proven stable |
| Semantic versioning and release tagging | Valuable when the project has external API consumers; not applicable to a personal blog |
| Renaming existing compozy task folders to TASK-prefix | Separate refactoring task; mixing concerns with CI/CD inflates scope |
| Self-hosted GitHub Actions runner on the VPS | Adds infra management overhead; GitHub-hosted runners are sufficient |
| Windows or ARM runner support | Not a requirement for this project's workflow |
| Multi-environment deploy (dev → staging → prod) | Single environment only in V1 |

---

## Phased Rollout Plan

### Phase 1 — Automated Pipeline (MVP)

Deliver F1 (CI quality gate) and F2 (CD deploy pipeline). The pipeline must be end-to-end functional: push to `main` → tests run → image builds → VPS updated → blog loads.

**Success criteria to proceed:** A real code change pushed to `main` deploys to the VPS in under 5 minutes with zero manual steps and zero broken builds reaching production.

### Phase 2 — Standards Enforcement

Deliver F3 (Conventional Commits enforcement), F4 (TASK-prefix branch naming), and F6 (migration-first deploy sequence).

**Success criteria to proceed:** All commits on `main` follow Conventional Commits format. No non-TASK branches exist except `main` and `hotfix/*`. The first real database migration deploys without downtime or data loss.

### Phase 3 — Auto-Changelog

Deliver F5 (auto-changelog generation). The `CHANGELOG.md` is generated, committed, and correct after the first main merge following Phase 2.

**Success criteria:** `CHANGELOG.md` updates automatically on every main merge, contains only `feat` and `fix` entries, and the changelog commit does not trigger a recursive pipeline run.

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Push-to-live latency | < 5 minutes | Time from `git push main` to container healthy on VPS |
| Failed deploys due to broken build | 0 | CI must pass before CD triggers |
| Commit message violations on `main` | 0 | Blocked by commit-msg hook + CI check |
| Non-TASK branches created | 0 (excluding `main`, `hotfix/*`) | GitHub Ruleset enforcement |
| Changelog entries per main merge | 1:1 | Auto-generated, zero manual entries |
| GitHub Secrets required for setup | ≤ 5 | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `VPS_DEPLOY_PATH` (deploy path; added to make the path configurable without hardcoding a convention) |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| VPS SSH key leaked via GitHub Secrets misconfiguration | Low | High | Use a dedicated deploy-only VPS user with minimal OS permissions; rotate key on any suspected exposure |
| Database migration fails mid-deploy, leaving stale schema | Medium | High | F6 sequencing ensures migration failure aborts before container restart; previous container continues serving |
| Conventional Commits friction blocks developer under time pressure | Medium | Low | `--no-verify` bypass documented in CONTRIBUTING; hotfix/* branch exempts the TASK prefix rule |
| GitHub Actions outage blocks all deploys | Low | Medium | `make deploy` in the Makefile remains a documented manual fallback; VPS is not locked to CI |
| Auto-changelog commit triggers recursive pipeline | Medium | Low | `[skip ci]` in changelog commit message prevents re-trigger; GitHub Actions respects this flag natively |
| GHCR image accumulation grows storage unbounded | Low | Low | GitHub's default retention policy handles old untagged images; add a cleanup workflow in V2 if needed |

---

## Architecture Decision Records

- [ADR-001: CI/CD V1 Scope — Pipeline-First, Standards-Included](adrs/adr-001.md) — Full scope including conventions and changelog confirmed; docker-rollout and folder rename deferred
- [ADR-002: Pipeline Architecture — Two Separate Workflows (CI + CD)](adrs/adr-002.md) — Separate `ci.yml` and `cd.yml` chosen over single workflow or manual approval gate

---

## Open Questions

- What is the VPS deploy user, and is that user already in the `docker` group? If not, `docker compose` commands require `sudo`, which complicates the SSH deploy step.
- Is there a reverse proxy (nginx, Caddy) in front of the app on the VPS, or does the app container expose port 3000 directly to the internet?
- Should the `GITHUB_TOKEN` used to push to GHCR also be used for the changelog auto-commit, or should a dedicated bot token be configured?
- Should the Ruleset block branch renames as well as creation, or only creation?
- What is the expected image tag strategy for GHCR — always `latest`, or tag by git SHA or date?
