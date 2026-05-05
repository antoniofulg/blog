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

## Before you commit

```sh
make test && make lint && make check
```
