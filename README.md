# Blog Platform

Personal blog scaffold: Bun, React 19, TanStack Start, Drizzle ORM, Better Auth, Tailwind CSS, BiomeJS.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Bun](https://bun.sh) (for `make dev` native path)

## Quick Start

```sh
git clone <repo-url>
cd blog
make setup
make dev
```

Open http://localhost:3000.

## Available Commands

```sh
make help          # List all targets with descriptions
```

### Development

| Command | Description |
|---------|-------------|
| `make setup` | First-clone: copy `.env`, start DB, run migrations |
| `make dev` | Native Bun dev server + Postgres in Docker (default) |
| `make dev-docker` | Fully containerized stack via `docker compose watch` |

> **`make dev-docker` notes:** requires Docker Desktop 4.24+. macOS hot reload may be unreliable due to a Bun file-event issue ([oven-sh/bun#9300](https://github.com/oven-sh/bun/issues/9300)) — use `make dev` for day-to-day work.

### Quality Gates

| Command | Description |
|---------|-------------|
| `make test` | Run Vitest test suite |
| `make lint` | Run Biome linter |
| `make format` | Run Biome formatter |
| `make check` | TypeScript type check (`tsc --noEmit`) |

### Build & Deploy

| Command | Description |
|---------|-------------|
| `make build` | Build production Docker image |
| `make preview` | Run production image locally |
| `make deploy` | Deploy to VPS (wire up `scripts/deploy.sh`) |

### Database

| Command | Description |
|---------|-------------|
| `make db-migrate` | Apply Drizzle migrations |
| `make db-generate` | Generate migrations from schema changes |
| `make db-seed` | Seed admin user |
| `make db-reset` | **Destructive**: drop, migrate, seed |

### Container Lifecycle

| Command | Description |
|---------|-------------|
| `make stop` | Stop all Docker Compose services |
| `make restart` | Restart DB service (native dev path) |
| `make restart-all` | Restart all Docker Compose services |
| `make logs` | Follow app container logs |
| `make shell` | Open shell in app container |

## Development workflow

### Branching

All branches must follow `TASK-XXXX/short-description` (zero-padded task number) or `hotfix/description`. `main` is always exempt. GitHub Ruleset enforces this at push time.

```sh
git checkout -b TASK-0005/my-feature
git checkout -b hotfix/broken-login    # emergency, no task number required
```

### Commit messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`

The `commit-msg` Lefthook hook validates on every local commit. CI re-validates all commits in a PR — `--no-verify` bypasses the local hook but not CI.

Only `feat` and `fix` appear in `CHANGELOG.md`.

### Before you commit

```sh
make test && make lint && make check
```

### CI checks on every PR

| Check | What it validates |
|-------|-------------------|
| `make test` | Vitest test suite |
| `make lint` | Biome linter |
| `make check` | TypeScript type check |
| commitlint | All commits follow Conventional Commits |
| branch-check | Branch name matches pattern |

All five must pass before merge is allowed.

### What happens on merge to main

CI re-runs on the merge commit → CD fires automatically:

1. Builds production Docker image → pushes to GHCR (`:latest` + `:<sha>`)
2. SSHes into VPS → runs migrations from new image → restarts app container
3. Commits updated `CHANGELOG.md` back to main with `[skip ci]`

VPS updated in ~5 minutes. No manual steps.

### Emergency hotfix

```sh
git checkout -b hotfix/description
git commit -m "fix(area): description" --no-verify   # if under pressure
git push origin hotfix/description
# open PR → CD deploys within 5 minutes
```

### Manual deploy fallback

```sh
export VPS_USER=deploy VPS_HOST=<ip> DEPLOY_PATH=/home/deploy/blog \
       GHCR_OWNER=<owner> GHCR_REPO=blog
bash scripts/deploy.sh   # or: make deploy
```

## Stack

- **Runtime**: Bun
- **Framework**: TanStack Start (SSR) + TanStack Router
- **Database**: PostgreSQL via Drizzle ORM + `postgres.js`
- **Auth**: Better Auth (email + password, HttpOnly cookies)
- **Content**: MDX files in `/content`, auto-indexed by fs.watch
- **Styling**: Tailwind CSS + `@tailwindcss/typography`
- **Linting**: BiomeJS (replaces ESLint + Prettier)
