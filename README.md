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

Open http://localhost:3000. See `CONTRIBUTING.md` for details.

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

## Stack

- **Runtime**: Bun
- **Framework**: TanStack Start (SSR) + TanStack Router
- **Database**: PostgreSQL via Drizzle ORM + `postgres.js`
- **Auth**: Better Auth (email + password, HttpOnly cookies)
- **Content**: MDX files in `/content`, auto-indexed by fs.watch
- **Styling**: Tailwind CSS + `@tailwindcss/typography`
- **Linting**: BiomeJS (replaces ESLint + Prettier)
