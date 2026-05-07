# TechSpec: CI/CD Pipeline + Branch & Commit Standards

## Executive Summary

Five files ship together: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `commitlint.config.js`, an updated `lefthook.yml`, and `scripts/deploy.sh`. One GitHub Ruleset is configured via the repository UI. No application code changes.

**Primary trade-off:** `scripts/deploy.sh` acts as the deploy interface for both GitHub Actions and `make deploy`. This preserves a manual fallback path at the cost of making the script responsible for SSH connection setup. The alternative (CI calling `appleboy/ssh-action` without touching the Makefile) would leave `make deploy` permanently broken.

The GHCR package is set to **public** visibility, eliminating the need to pass authentication credentials to the VPS on every deploy. If the repository becomes private, a single PAT with `read:packages` scope stored in `~/.docker/config.json` on the VPS restores the pull.

---

## System Architecture

### Component Overview

```
.github/workflows/
  ci.yml          ← quality gate: runs on every push and PR
  cd.yml          ← deploy: runs on push to main only

scripts/
  deploy.sh       ← SSH deploy script: called by cd.yml and make deploy

commitlint.config.js  ← commitlint rules (extends angular preset)
lefthook.yml          ← pre-commit (existing) + new commit-msg hook
package.json          ← adds @commitlint/cli, @commitlint/config-conventional

GitHub Ruleset        ← branch naming enforcement (configured in UI)
GHCR                  ← Docker image registry (github.com/users/{owner}/packages)
```

**Data flows:**

**CI path (every push / PR):**
```
git push or PR open
  → ci.yml triggers
      → quality job matrix: make test, make lint, make check (3 parallel runners)
      → commitlint job (PRs only): bunx commitlint --from base.sha --to head.sha
      → branch-check job (PRs only): regex match on $GITHUB_HEAD_REF
  → All jobs green → merge allowed
  → Any job fails → merge blocked
```

**CD path (push to main only):**
```
git push main (after CI passes)
  → cd.yml triggers
      → build-push job:
          docker build --target runner
          docker push ghcr.io/$REPO:$SHA
          docker push ghcr.io/$REPO:latest
      → deploy job (needs: build-push):
          SSH into VPS
          docker pull ghcr.io/$REPO:latest
          cd $DEPLOY_PATH && make db-migrate
          docker compose up -d --no-deps app
      → changelog job (needs: deploy):
          bunx conventional-changelog-cli -p angular -i CHANGELOG.md -s -r 0
          git commit -m "chore: update changelog [skip ci]"
          git push
```

**Local commit path:**
```
git commit
  → lefthook pre-commit: biome check --write (existing)
  → lefthook commit-msg: bunx commitlint --edit (new)
  → commit blocked if message is non-conforming
```

**Branch creation:**
```
git push origin TASK-0004/my-feature
  → GitHub Ruleset evaluates branch name regex
  → Blocked if pattern does not match ^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$
```

---

## Implementation Design

### Core Interfaces

**`scripts/deploy.sh`** — the canonical deploy interface:

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${VPS_USER:?VPS_USER env var required}"
: "${VPS_HOST:?VPS_HOST env var required}"
: "${DEPLOY_PATH:?DEPLOY_PATH env var required}"
VPS_PORT="${VPS_PORT:-22}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:latest"

ssh -p "$VPS_PORT" -o StrictHostKeyChecking=accept-new \
  "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && \
   cd $DEPLOY_PATH && \
   make db-migrate && \
   docker compose up -d --no-deps app && \
   echo '[deploy] done: $IMAGE'"
```

Called by:
- `cd.yml` deploy job — env vars injected from GitHub Secrets
- `make deploy` — env vars loaded from `.env` or exported in the shell

**`commitlint.config.js`:**

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always',
      ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'ci'],
    ],
  },
};
```

**`lefthook.yml`** — diff from current (add commit-msg hook):

```yaml
pre-commit:
  commands:
    biome:                              # ← existing, unchanged
      glob: "*.{js,jsx,ts,tsx,json,css}"
      run: ./node_modules/.bin/biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true

commit-msg:                             # ← new section
  commands:
    commitlint:
      run: ./node_modules/.bin/commitlint --edit {1}
```

**`ci.yml`** — abbreviated structure:

```yaml
on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  quality:
    strategy:
      fail-fast: false
      matrix:
        check: [test, lint, check]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: make ${{ matrix.check }}

  commitlint:
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx commitlint --from ${{ github.event.pull_request.base.sha }}
                             --to   ${{ github.event.pull_request.head.sha }}

  branch-check:
    if: github.event_name == 'pull_request'
    steps:
      - name: Validate branch name
        run: |
          echo "${{ github.head_ref }}" | \
          grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$' || \
          { echo "Branch must match TASK-XXXX/slug or hotfix/*"; exit 1; }
```

**`cd.yml`** — abbreviated structure:

```yaml
on:
  push:
    branches: [main]

jobs:
  build-push:
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          target: runner
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy:
    needs: build-push
    steps:
      - uses: actions/checkout@v4
      - uses: webfactory/ssh-agent@v0.9.0
        with: { ssh-private-key: "${{ secrets.VPS_SSH_KEY }}" }
      - env:
          VPS_USER: ${{ secrets.VPS_USER }}
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_PORT: ${{ secrets.VPS_PORT }}
          DEPLOY_PATH: ${{ secrets.VPS_DEPLOY_PATH }}
          GHCR_OWNER: ${{ github.repository_owner }}
          GHCR_REPO: ${{ github.event.repository.name }}
        run: bash scripts/deploy.sh

  changelog:
    needs: deploy
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx conventional-changelog-cli -p angular -i CHANGELOG.md -s -r 0
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add CHANGELOG.md
          git diff --staged --quiet || \
            git commit -m "chore: update changelog [skip ci]" && \
            git push
```

### Data Models

**GitHub Secrets required (one-time setup):**

| Secret | Description | Example |
|---|---|---|
| `VPS_HOST` | VPS IP address or hostname | `203.0.113.10` |
| `VPS_USER` | Deploy user on VPS | `deploy` |
| `VPS_SSH_KEY` | Full Ed25519 private key (including header/footer) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT` | SSH port | `22` |
| `VPS_DEPLOY_PATH` | Absolute path to project on VPS | `/home/deploy/blog` |

**GitHub Ruleset regex** (configured in Settings → Rules → Rulesets):

```
^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$
```

Matches: `TASK-0003/cicd-vps-pipeline`, `TASK-42/fix-login`, `hotfix/broken-auth`
Blocks: `feature/my-thing`, `fix-layout`, `main` (main is always exempt from rulesets)

**Package additions to `package.json`:**

```json
"devDependencies": {
  "@commitlint/cli": "19.8.1",
  "@commitlint/config-conventional": "19.8.1"
}
```

Versions must be pinned (no `^` or `~`) to match the project's pinning convention.

### API Endpoints

This feature introduces no new HTTP endpoints. All automation runs via GitHub Actions and SSH.

---

## Integration Points

**GitHub Container Registry (GHCR):**
- Authentication in CI: `GITHUB_TOKEN` (automatic, no secret needed)
- Authentication on VPS: GHCR package set to **public** visibility via GitHub UI (`github.com/{owner}/{repo}/pkgs/container/{repo}` → Settings → Make public). No VPS auth required.
- If private visibility is required: store a PAT with `read:packages` scope on VPS via `docker login ghcr.io` once manually; credentials persist in `~/.docker/config.json`.

**VPS SSH access:**
- Generate a dedicated Ed25519 key pair (`ssh-keygen -t ed25519 -C "github-actions-deploy"`)
- Add the public key to VPS `~/.ssh/authorized_keys` for the deploy user
- Store the private key as `VPS_SSH_KEY` GitHub Secret
- Deploy user must be in the `docker` group (`sudo usermod -aG docker $VPS_USER`) so `docker compose` runs without `sudo`

**Lefthook hooks registration:**
- `lefthook install` must be run after `bun install` to register Git hooks
- Already runs in the repo via `bunx lefthook install` (from the existing biome test in `app/tests/biome.test.ts`)

---

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `lefthook.yml` | modified | Add `commit-msg` hook calling commitlint | Add `commit-msg` section; run `lefthook install` after |
| `package.json` | modified | Add 2 commitlint devDependencies | Add pinned versions; run `bun install` |
| `scripts/deploy.sh` | new | SSH deploy script; activates `make deploy` stub | Create file; set executable bit |
| `.github/workflows/ci.yml` | new | CI quality gate; 5 jobs | Create file |
| `.github/workflows/cd.yml` | new | CD pipeline; 3 jobs | Create file |
| `commitlint.config.js` | new | commitlint rule configuration | Create file |
| `CHANGELOG.md` | new | Auto-generated by CD on first successful deploy | Created automatically; do not create manually |
| `Makefile` | none | `make deploy` already calls `scripts/deploy.sh` when it exists | No change needed |
| GitHub Ruleset | new | Branch naming enforcement; UI config | One-time configuration in repo Settings |
| GHCR package visibility | new | Set to public so VPS can pull without credentials | One-time action after first image push |

---

## Testing Approach

### Unit Tests

The CI/CD system has no traditional unit tests. Validation is done through:

- **Commitlint config:** Run `echo "feat: valid message" | bunx commitlint` and `echo "invalid" | bunx commitlint` locally — verify pass and fail respectively.
- **Branch regex:** Test against sample branch names locally: `echo "TASK-0003/test" | grep -qE '^(TASK-[0-9]+/...|hotfix/.+)$'`
- **deploy.sh syntax:** Run `bash -n scripts/deploy.sh` to verify no syntax errors before pushing.

### Integration Tests

**Smoke test sequence after initial setup:**

1. Push a feature branch with a conforming name (`TASK-0003/cicd-vps-pipeline`) — verify CI triggers
2. Open a PR — verify commitlint and branch-check jobs appear as status checks
3. Commit with a non-conforming message locally — verify `commit-msg` hook blocks it
4. Try to create a non-TASK branch (`git push origin feature/test`) — verify GitHub Ruleset blocks it
5. Merge PR to `main` — verify CD triggers: image appears in GHCR, blog loads on VPS, CHANGELOG.md updates

**Regression check:** After setup, run `make test && make lint && make check` locally to confirm commitlint/lefthook additions have not broken the existing quality gate.

---

## Development Sequencing

### Build Order

1. **Update `package.json`** — add `@commitlint/cli` and `@commitlint/config-conventional` as pinned devDependencies. No code deps.

2. **Create `commitlint.config.js`** — depends on step 1. Defines the type allowlist. Must exist before lefthook calls commitlint.

3. **Update `lefthook.yml`** — depends on step 1. Add `commit-msg` hook. Run `bunx lefthook install` after editing to register the new hook in `.git/hooks/`.

4. **Run `bun install`** — installs commitlint from step 1. Lefthook from step 3 is now active; all subsequent commits in this branch are validated.

5. **Create `scripts/deploy.sh`** — depends on VPS being provisioned (deploy user created, docker group, project path). No code deps from steps 1-4. Set `chmod +x scripts/deploy.sh`.

6. **Create `.github/workflows/ci.yml`** — depends on steps 1-4 being committed. The quality job matrix delegates to `make test`, `make lint`, `make check` — all already working. The commitlint job requires commitlint installed (step 1).

7. **Create `.github/workflows/cd.yml`** — depends on step 5 (`scripts/deploy.sh` must exist) and GitHub Secrets configured. The deploy job fails if `VPS_SSH_KEY` is not set.

8. **Configure GitHub Ruleset** — independent of code changes. Configure via repository Settings → Rules → Rulesets after the first push. Apply to all branches; exempt `main`.

9. **Set GHCR package to public** — one-time UI action after the first successful CD run produces the image. Navigate to `github.com/{owner}/packages/container/blog/settings`.

### Technical Dependencies

- VPS must exist and be reachable before step 5 can be tested end-to-end.
- Deploy user on VPS must be in the `docker` group before `scripts/deploy.sh` can run `docker compose` without `sudo`.
- The blog project (`docker-compose.yml`, `.env`) must already be checked out on the VPS at `$DEPLOY_PATH` before the first deploy.
- `bun.lock` must be committed in the repository (already the case) so `bun install --frozen-lockfile` succeeds in CI without a network fetch for every dep.

---

## Monitoring and Observability

**Pipeline visibility:**
- `ci.yml` and `cd.yml` produce distinct status checks visible on every commit and PR in the GitHub UI.
- GitHub Secrets misconfiguration produces a clear `secret not found` error in the deploy job output.
- `scripts/deploy.sh` echoes each step with a `[deploy]` prefix; visible in the GitHub Actions job log.

**CHANGELOG.md as audit log:**
- Every successful deploy to `main` that contains `feat` or `fix` commits produces a dated CHANGELOG entry. Acts as a human-readable record of what changed and when.

**Structured log events from `scripts/deploy.sh`:**

| Event | Output |
|---|---|
| Image pull start | `[deploy] pulling ghcr.io/{owner}/blog:latest` |
| Migration step | `[deploy] running db:migrate` |
| Container restart | `[deploy] restarting app container` |
| Deploy complete | `[deploy] done: ghcr.io/{owner}/blog:latest` |

---

## Technical Considerations

### Key Decisions

**`scripts/deploy.sh` as the shared deploy interface**
The Makefile `deploy` target already checks for `scripts/deploy.sh` and calls it. Creating this file activates `make deploy` automatically — no Makefile changes required. Both CI and the developer's local machine call the same script with the same logic, ensuring identical deploy behavior. The only difference is how env vars are injected (GitHub Secrets in CI vs `.env` or exported vars locally).

**GHCR public visibility instead of PAT-based VPS auth**
A PAT stored on the VPS would need manual rotation on expiry and creates a long-lived credential. Making the GHCR package public eliminates both concerns: the VPS pulls without credentials, and there is nothing to rotate. For a personal blog whose content is publicly readable anyway, the image being public adds no additional exposure. The production secrets (DATABASE_URL, ADMIN_PASSWORD) are never in the image — they come from `.env` at runtime.

**Angular preset for conventional-changelog**
The Angular preset shows only `feat`, `fix`, and `perf` commits in the changelog — matching the PRD requirement of "user-facing only" (feat + fix). The `perf` type is negligible; no performance commits are expected in a personal blog. Custom preset configuration is not needed.

**`[skip ci]` on changelog commit**
The changelog auto-commit uses `chore: update changelog [skip ci]` as its message. GitHub Actions skips all workflow runs for commits containing `[skip ci]`. This prevents the changelog commit from triggering a recursive CD run. The `[skip ci]` token is checked at the repository level, not per-workflow, so no per-workflow configuration is needed.

### Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| VPS host key not in known_hosts — SSH fails on first connection | High (first deploy only) | Use `StrictHostKeyChecking=accept-new` in `scripts/deploy.sh`; this accepts on first connect and saves the key |
| `make db-migrate` fails on VPS because `.env` is missing `DATABASE_URL` | Medium | Document that `.env` must exist at `$DEPLOY_PATH` before first deploy; the migration command will fail loudly |
| Commitlint `commit-msg` hook runs on merge commits — merge commits may not conform | Low | Add `defaultIgnores: true` to `commitlint.config.js`; commitlint ignores merge commits by default |
| GHCR image accumulates — storage grows unbounded | Low | GitHub's free tier includes 500MB for private packages and unlimited for public; add a cleanup workflow in V2 |
| SSH key stored as GitHub Secret is inadvertently logged | Very low | GitHub Actions automatically redacts secrets from logs; never echo `$VPS_SSH_KEY` in a run step |
| Changelog commit author is `github-actions[bot]` — may confuse git blame | Low | Acceptable; the commit message `[skip ci]` and bot author clearly identify it as automation |

---

## Architecture Decision Records

- [ADR-001: CI/CD V1 Scope — Pipeline-First, Standards-Included](adrs/adr-001.md) — Full scope including commit conventions, branch naming, and auto-changelog confirmed; docker-rollout and folder rename deferred
- [ADR-002: Pipeline Architecture — Two Separate Workflows (CI + CD)](adrs/adr-002.md) — `ci.yml` and `cd.yml` chosen over single workflow or manual approval gate
- [ADR-003: GHCR Image Tagging — Git SHA + latest](adrs/adr-003.md) — Dual-tag strategy (SHA for traceability, latest for VPS pulls) over latest-only or date-stamped tags
