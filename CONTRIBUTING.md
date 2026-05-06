# Contributing

## Prerequisites

- `make dev-docker`: [Docker Desktop](https://www.docker.com/products/docker-desktop/) only
- `make dev`: [Bun](https://bun.sh) + Docker Desktop (native path, default)

## Quick start

```sh
git clone <repo-url>
cd blog
make setup
make dev
```

Open http://localhost:3000.

`make setup` copies `.env.example` → `.env`, starts Postgres, and runs migrations.
On each `bun dev` start, `vite.config.ts` runs migrations (idempotent) and seeds the
admin user if it does not already exist. Existing posts, view counts, and publish state
are preserved across restarts. To reset all data, run `make db-reset`.

## Available commands

Run `make help` for the full list of targets with descriptions.

## Dev paths

| Command | Description |
|---------|-------------|
| `make dev` | Native Bun dev server + Postgres in Docker (default, fastest HMR) |
| `make dev-docker` | Fully containerized via `docker compose watch` (opt-in) |

**`make dev-docker` notes:**

- Requires Docker Desktop 4.24+ for `docker compose watch` support
- macOS hot reload may be unreliable due to a Bun file-event issue
  ([oven-sh/bun#9300](https://github.com/oven-sh/bun/issues/9300));
  use `make dev` for faster day-to-day iteration

## Branching

All branches must follow `TASK-XXXX/short-description` where `XXXX` is the zero-padded compozy task number:

```sh
git checkout -b TASK-0005/my-feature
```

GitHub Ruleset blocks pushes that don't match this pattern. Two exemptions:

- `main` — always exempt
- `hotfix/*` — emergency production patches, no task number required

## Commit messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`

Examples:

```sh
git commit -m "feat(blog): add post list pagination"
git commit -m "fix(auth): handle expired session cookie"
git commit -m "chore: update dependencies"
```

The `commit-msg` Lefthook hook blocks non-conforming messages immediately on commit. The CI workflow re-validates all commits in a PR — `--no-verify` bypasses the local hook but not the CI check.

**Emergency escape hatch:** `git commit --no-verify` skips the local hook. Use only for production incidents. Document the bypass retroactively.

Only `feat` and `fix` commits appear in `CHANGELOG.md`. Other types are excluded.

## Daily workflow

```
1. git checkout -b TASK-0005/my-feature
2. make changes, write tests
3. make test && make lint && make check
4. git commit -m "feat(blog): description"   ← hook validates on commit
5. git push origin TASK-0005/my-feature
6. open PR → CI runs automatically (test + lint + check + commitlint + branch-check)
7. all checks green → merge to main
8. CD fires automatically → image built → VPS updated → CHANGELOG.md committed
```

Push to live in under 5 minutes. No manual deploy steps.

## CI checks on every PR

| Check | What it validates |
|-------|-------------------|
| `make test` | Vitest test suite |
| `make lint` | Biome linter |
| `make check` | TypeScript type check |
| commitlint | All commits in PR follow Conventional Commits |
| branch-check | Branch name matches `TASK-XXXX/slug` or `hotfix/*` |

All five must be green before merge is allowed.

## What happens on merge to main

1. CI re-runs on the merge commit
2. On CI pass, CD fires automatically:
   - Builds production Docker image → pushes to GHCR
   - SSH into VPS → `make db-migrate` → `docker compose up -d --no-deps app`
   - Commits updated `CHANGELOG.md` back to main with `[skip ci]`

The VPS is updated within ~5 minutes of merge. No manual steps required.

## Emergency hotfix

```sh
git checkout -b hotfix/broken-login    # Ruleset exempts hotfix/* branches
# fix the issue
git commit -m "fix(auth): ..." --no-verify   # --no-verify if no time for proper message
git push origin hotfix/broken-login
# open PR or push directly to main
```

CD fires and deploys within 5 minutes. Create a compozy task for tracking retroactively.

## Manual deploy fallback

If GitHub Actions is unavailable:

```sh
export VPS_USER=deploy VPS_HOST=<ip> DEPLOY_PATH=/home/deploy/blog GHCR_OWNER=<owner> GHCR_REPO=blog
bash scripts/deploy.sh
```

Or via Make if env vars are exported:

```sh
make deploy
```

## Before you commit

```sh
make test && make lint && make check
```
