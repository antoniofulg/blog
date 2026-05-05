# TechSpec: Dockerized Dev Environment + Makefile

## Executive Summary

Five files ship together: a new `Makefile`, a new `Dockerfile`, an updated `docker-compose.yml`, a new `.dockerignore`, and a new `CONTRIBUTING.md`. No application code changes. The Makefile delegates to existing `package.json` scripts via `bun run`; it introduces no new logic. The Dockerfile uses three named stages (`dev`, `builder`, `runner`) so the same file serves both `make dev-docker` (containerized dev) and `make build` (production image).

**Primary trade-off:** Three-stage Dockerfile adds a small read-time overhead for contributors unfamiliar with named stages, but eliminates the need for a separate `Dockerfile.dev` and avoids compose file merging in `make dev-docker`.

---

## System Architecture

### Component Overview

```
Makefile                   ← single entry point for all developer actions
  │
  ├── bun run <script>      ← delegates to package.json scripts (test, lint, build, db:*)
  ├── docker compose ...    ← delegates to Docker Compose for container lifecycle
  └── docker build ...      ← delegates to Dockerfile for image builds

Dockerfile (3 stages)
  ├── dev     ← bun install only; CMD bun dev; used by docker-compose app service
  ├── builder ← extends dev; COPY source; RUN bun run build
  └── runner  ← oven/bun:1-alpine; COPY .output/ only; CMD bun .output/server/index.mjs

docker-compose.yml
  ├── db      ← postgres:16-alpine (existing, unchanged)
  └── app     ← builds from Dockerfile dev stage; develop: watch: blocks for make dev-docker

.dockerignore               ← excludes node_modules, .output, .env, .git from build context
CONTRIBUTING.md             ← documents make setup && make dev as the two-command onboarding
```

### Data Flow

**`make dev` (native path):**
```
make dev
  → docker compose up db -d        (start Postgres container)
  → bun dev                         (Vite dev server on host, port 3000)
      → vite.config.ts configureServer hook
          → execFileSync db:migrate  (Drizzle migrations)
          → execFileSync db:seed     (seed via scripts/seed.ts)
          → spawn scripts/watcher.ts (content indexer)
```

**`make dev-docker` (containerized path):**
```
make dev-docker
  → docker compose watch
      → builds app service (dev stage: bun install only)
      → starts db service (postgres:16-alpine with healthcheck)
      → waits for db healthy (depends_on condition: service_healthy)
      → starts app service (bun dev --port 3000)
      → watches ./app → sync to /app/app
      → watches ./content → sync to /app/content
      → watches package.json / bun.lock → rebuild image
```

**`make build` (production image):**
```
make build
  → docker build -t blog .          (builds runner stage)
      → dev stage: bun install --frozen-lockfile
      → builder stage: COPY .; bun run build → .output/
      → runner stage: COPY .output/; EXPOSE 3000
```

---

## Implementation Design

### Core Interfaces

The primary interface is the Makefile target contract. Every target follows this shape:

```makefile
.DEFAULT_GOAL := help
.PHONY: help setup dev dev-docker build preview \
        test lint format check \
        db-migrate db-generate db-seed db-reset \
        stop restart logs shell deploy

IMAGE_NAME    ?= blog
CONTAINER_APP ?= blog-app

help: ## Show all available targets and descriptions
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z_-]+:.*?##/ \
	  { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
```

Full target implementations are specified in the **Development Sequencing** section.

### Dockerfile Stages

```dockerfile
# Stage 1: dev — used by docker-compose for make dev-docker
FROM oven/bun:1 AS dev
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
CMD ["bun", "dev", "--port", "3000"]

# Stage 2: builder — produces .output/ artifact
FROM dev AS builder
COPY . .
RUN bun run build

# Stage 3: runner — minimal production image
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
```

> **Note:** Verify `.output/server/index.mjs` is the correct entry path after first `make build`. Nitro bun preset may output `index.ts` or a different path — update CMD if needed.

### docker-compose.yml Changes

Extend existing file by adding the `app` service. The `db` service and `postgres_data` volume remain unchanged.

```yaml
services:
  db:
    # ... existing unchanged ...

  app:
    build:
      context: .
      target: dev
    command: bun dev --port 3000
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - /app/node_modules        # anonymous volume: isolates container deps from host
    develop:
      watch:
        - action: sync
          path: ./app
          target: /app/app
        - action: sync
          path: ./content
          target: /app/content
        - action: rebuild
          path: package.json
        - action: rebuild
          path: bun.lock
```

### .dockerignore

```
node_modules
.output
.nitro
.tanstack
.git
.env
.env.*
!.env.example
drizzle
*.local
.DS_Store
```

### Makefile — All Targets

```makefile
.DEFAULT_GOAL := help
.PHONY: help setup dev dev-docker build preview \
        test lint format check \
        db-migrate db-generate db-seed db-reset \
        stop restart logs shell deploy

IMAGE_NAME    ?= blog
CONTAINER_APP ?= blog-app

# ── Discovery ─────────────────────────────────────────────────────────────────

help: ## Show available targets
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z_-]+:.*?##/ \
	  { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Onboarding ────────────────────────────────────────────────────────────────

setup: ## First-clone: copy .env, start DB, run migrations
	@test -f .env || cp .env.example .env
	@grep -q 'DATABASE_URL=postgres://blog:blog@localhost' .env \
	  && echo "ERROR: Change DATABASE_URL in .env before running setup." && exit 1 \
	  || true
	docker compose pull db
	docker compose up db -d
	@echo "Waiting for database..."
	@until docker compose exec db pg_isready -U blog > /dev/null 2>&1; do sleep 1; done
	bun run db:migrate
	@echo "Setup complete. Run: make dev"

# ── Development ───────────────────────────────────────────────────────────────

dev: ## Start native Bun dev server with Postgres in Docker (default)
	docker compose up db -d
	bun dev

dev-docker: ## Start fully containerized stack with file sync (opt-in; macOS HMR may vary)
	docker compose watch

# ── Build & Preview ───────────────────────────────────────────────────────────

build: ## Build production Docker image
	docker build -t $(IMAGE_NAME) .

preview: ## Run production image locally (validates build before deploy)
	docker run --rm --env-file .env -p 3000:3000 --name $(CONTAINER_APP) $(IMAGE_NAME)

# ── Quality Gates ─────────────────────────────────────────────────────────────

test: ## Run Vitest test suite
	bun run test

lint: ## Run Biome linter
	bun run lint

format: ## Run Biome formatter
	bun run format

check: ## Run TypeScript type check (tsc --noEmit)
	bunx tsc --noEmit

# ── Database ──────────────────────────────────────────────────────────────────

db-migrate: ## Run Drizzle migrations
	bun run db:migrate

db-generate: ## Generate Drizzle migration files from schema changes
	bun run db:generate

db-seed: ## Seed the database with development data
	bun run db:seed

db-reset: ## DESTRUCTIVE: drop schema, migrate, and seed
	docker compose exec db psql -U blog -c \
	  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	bun run db:migrate
	bun run db:seed

# ── Container Lifecycle ───────────────────────────────────────────────────────

stop: ## Stop all Docker Compose services
	docker compose down

restart: ## Restart all Docker Compose services
	docker compose down && docker compose up -d

logs: ## Follow app container logs
	docker compose logs -f app

shell: ## Open interactive shell in app container
	docker compose exec app sh

# ── Deploy ────────────────────────────────────────────────────────────────────

deploy: ## Deploy to VPS (create scripts/deploy.sh to activate)
	@test -f scripts/deploy.sh \
	  && bash scripts/deploy.sh \
	  || echo "No deploy script found. Create scripts/deploy.sh with your VPS deploy steps."
```

**Note on `make check`:** `package.json` has a `check` script that runs `biome check` (linting + formatting combined). `make check` must NOT delegate to `bun run check` — it calls `bunx tsc --noEmit` directly to avoid naming collision and to perform TypeScript type checking as PRD F7 specifies.

### CONTRIBUTING.md — Minimum Content

```markdown
# Contributing

## Quick start

Requires: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```
git clone <repo-url>
cd blog
make setup
make dev
```

Open http://localhost:3000.

## All available commands

Run `make help` to list every developer action with a description.

## Dev workflow

- `make dev` — native Bun dev server (default, fastest HMR)
- `make dev-docker` — fully containerized stack (opt-in; for CI environment parity)
- `make test && make lint` — run before every commit
```

---

## Integration Points

### vite.config.ts — configureServer hook

`vite.config.ts` runs `db:migrate` **and** `db:seed` via `execFileSync` on every `bun dev` start. This means:

- `make dev` will auto-seed on each restart via the existing Vite hook — `make setup` intentionally skips seeding for scripts that don't need sample data.
- `make dev-docker` also inherits this behavior because the app container runs `bun dev`.
- This is existing behavior, not introduced by this feature. Document in CONTRIBUTING.md that dev data resets on each restart.

### .env / .env.example

`make setup` reads `.env.example` as source of truth. The validation guard checks `DATABASE_URL` is not the default `postgres://blog:blog@localhost` value, forcing contributors to explicitly review credentials. The three existing vars (`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`) cover all current needs.

`make preview` passes `.env` to the production container via `--env-file .env`. No `VITE_*` (client-side) vars exist in the current codebase — if added in future, they must be passed as `--build-arg` during `docker build`, not at runtime.

---

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `Makefile` | new | 10 target groups; primary developer interface | Create at project root |
| `Dockerfile` | new | 3-stage build (dev/builder/runner); low risk | Create at project root |
| `docker-compose.yml` | modified | Add `app` service with watch blocks; `db` service unchanged | Add app service block |
| `.dockerignore` | new | Excludes `node_modules`, `.output`, `.env`, `.git` | Create at project root |
| `CONTRIBUTING.md` | new | Two-command onboarding; no risk | Create at project root |
| `vite.config.ts` | read-only | Existing `configureServer` hook seeds on `bun dev`; no changes needed | Document behavior in CONTRIBUTING.md |
| `package.json` | none | Makefile delegates to existing scripts; no changes | None |
| `drizzle.config.ts` | none | Unchanged; Makefile wraps existing CLI commands | None |
| `scripts/seed.ts` | none | Called by `make db-seed` via `bun run db:seed` | None |
| `.gitignore` | none | `docker-compose.override.yml` already excluded | None |

---

## Testing Approach

### Smoke Tests (manual, run after implementation)

1. **Fresh-clone onboarding:**
   ```
   rm -rf .env node_modules
   make setup
   make dev
   # → browser opens at localhost:3000; posts load; no errors in terminal
   ```

2. **Production build:**
   ```
   make build
   make preview
   # → localhost:3000 serves production bundle; check .output/ is populated
   ```

3. **Containerized dev:**
   ```
   make dev-docker
   # → edit a file in app/; observe browser update
   # → edit package.json; observe image rebuild
   ```

4. **Quality gates:**
   ```
   make test && make lint && make format && make check
   # → all exit 0
   ```

5. **Database targets:**
   ```
   make db-reset
   # → schema drops, migrates, seeds without error
   make db-generate
   # → exits cleanly (no schema drift)
   ```

### Regression Checks

- `make dev` behavior matches current `docker compose up -d && bun dev` (documented in existing `docker-compose.yml` comment).
- Existing `bun run test` and `bun run lint` scripts continue to pass (Makefile delegates, does not modify).
- `docker-compose.yml` `db` service healthcheck interval/retries unchanged.

---

## Development Sequencing

### Build Order

1. **`.dockerignore`** — no dependencies; define first so subsequent `docker build` calls exclude the right files
2. **`Dockerfile`** — depends on step 1; three named stages (`dev`, `builder`, `runner`); verify `.output/server/index.mjs` path after first build
3. **`docker-compose.yml` — add `app` service** — depends on step 2 (`build: target: dev` references Dockerfile); `db` service block is unchanged
4. **`Makefile`** — depends on steps 2–3; all `docker compose` and `docker build` targets require the Dockerfile and updated compose file to be correct
5. **`CONTRIBUTING.md`** — depends on step 4; references `make setup` and `make dev` which must work before documenting them

### Technical Dependencies

- Docker Desktop must be installed on the developer machine before any step can be verified.
- Bun must be installed on the host for `make dev` and all `bun run` targets (quality gates, db targets).
- `make dev-docker` requires Docker Desktop 4.24+ for `docker compose watch` GA support.
- `bunx tsc --noEmit` (`make check`) requires `typescript` in `devDependencies` — already present at `6.0.3`.

---

## Monitoring and Observability

- `make logs` follows `docker compose logs -f app` — primary observability for containerized runs.
- `make dev` (native) logs directly to the terminal.
- No additional logging infrastructure required; this feature introduces no server-side code.

---

## Technical Considerations

### Key Decisions

**`make check` calls `bunx tsc --noEmit` directly, not `bun run check`**
- `package.json` `check` script runs `biome check` (linting + formatting), not TypeScript.
- Delegating `make check` → `bun run check` would silently skip type checking.
- Using `bunx tsc --noEmit` calls TypeScript directly from `devDependencies`.

**`db-reset` uses `psql DROP SCHEMA` not volume deletion**
- Requires DB container to be running.
- Faster than stop → volume delete → start → migrate cycle.
- Drops and recreates the `public` schema; all tables, sequences, and data are destroyed.
- Acceptable for dev-only target; not callable from `make dev-docker` container without `docker compose exec`.

**`make setup` validation guard uses `grep` on `DATABASE_URL`**
- Checks for the literal default value `postgres://blog:blog@localhost` in `.env`.
- Exits 1 with a clear message if the default is still present.
- Does not validate all three vars — only the one most likely to break silently.

**`make dev` does not wait for DB healthcheck**
- `docker compose up db -d` starts Postgres in the background.
- Bun dev server starts immediately; Vite's `configureServer` hook calls `db:migrate` which will retry if DB is not ready yet (Drizzle handles connection retry).
- Unlike `make setup`, there is no `pg_isready` poll — keeping `make dev` fast for repeat use.

### Known Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `.output/server/index.mjs` path differs from Nitro bun preset output | Medium | Verify after first `make build`; update CMD in Dockerfile runner stage |
| `docker compose watch` not available on Docker Desktop < 4.24 | Low | `make help` documents minimum Docker Desktop version |
| `bunx tsc --noEmit` slow on first run (downloads tsc if not cached) | Low | `typescript` is in devDependencies; Bun cache makes repeat runs fast |
| `db-reset` fails if DB container is not running | Medium | `make db-reset` should check or document that DB must be up; add note to Makefile `##` comment |
| `make preview` conflicts with existing `bun run preview` | Low | `make preview` runs `docker run`, not `bun run preview`; no naming conflict in Makefile |

---

## Architecture Decision Records

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `make dev` runs Bun natively; `make dev-docker` is the opt-in full-stack container target
- [ADR-002: Full V1 Scope — Complete Makefile + Dockerfile in Single Delivery](adrs/adr-002.md) — All 10 target groups ship together; partial Makefile rejected as leaky abstraction
- [ADR-003: Multi-Stage Dockerfile with Named Build Targets](adrs/adr-003.md) — Three named stages (`dev`, `builder`, `runner`) in one Dockerfile serve both dev-docker and production build
