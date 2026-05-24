.DEFAULT_GOAL := help
.PHONY: help setup dev dev-docker build preview \
        test lint format check lint-tests test-e2e audit-content audit-fe app-audit audit audit-watch \
        db-migrate db-generate db-seed db-sync db-reset \
        stop restart restart-all logs shell deploy

IMAGE_NAME    ?= blog
CONTAINER_APP ?= blog-app

# -- Build artifacts -----------------------------------------------------------

# Nitro production bundle path; declared here so audit-fe + audit can declare
# it as a Make-native prerequisite and rebuild only when sources changed.
NITRO_BUNDLE := .output/server/index.mjs
# Source set that, when newer than NITRO_BUNDLE, forces a rebuild. Evaluated
# at parse time via $(shell ...) — a brand-new source file is picked up on the
# next make invocation, which is the same behavior as `bun run build` itself.
APP_SOURCES  := $(shell find app scripts -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null)

# -- Discovery -----------------------------------------------------------------

help: ## Show available targets
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z_-]+:.*?##/ \
	  { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# -- Onboarding ----------------------------------------------------------------

setup: ## First-clone: copy .env, start DB, run migrations
	@test -f .env || cp .env.example .env
	docker compose pull db
	docker compose up db -d
	@echo "Waiting for database..."; \
	  PGUSER=$$(grep '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2); \
	  PGUSER=$${PGUSER:-blog}; \
	  i=0; \
	  until docker compose exec db pg_isready -U $$PGUSER > /dev/null 2>&1; do \
	    i=$$((i+1)); \
	    if [ $$i -ge 30 ]; then \
	      echo "ERROR: Postgres did not become ready after 30 seconds."; \
	      echo "Check: docker compose logs db"; \
	      exit 1; \
	    fi; \
	    sleep 1; \
	  done
	bun run db:migrate
	@echo "Setup complete. Next: make dev or make dev-docker"

# -- Development ---------------------------------------------------------------

dev: ## Start native Bun dev server with Postgres in Docker (default)
	docker compose up db -d
	@echo "Starting dev server → http://localhost:3000  (Ctrl+C to stop)"
	bun dev
	@echo "Server stopped. Next: make dev | make build | make test"

dev-docker: ## Start fully containerized stack with file sync (opt-in; macOS HMR may vary)
	@echo "Starting containerized stack → http://localhost:3000  (Ctrl+C to stop)"
	docker compose watch
	@echo "Stack stopped. Next: make dev | make build | make test"

# -- Build & Preview -----------------------------------------------------------

build-js: ## Build JS/SSR bundle (bun run build) — run in CI before Docker build
	bun run build
	@echo "JS build complete. Next: make build | make check | make test"

build: ## Build production Docker image
	docker build -t $(IMAGE_NAME) .
	@echo "Image built → $(IMAGE_NAME). Next: make preview | make deploy"

preview: ## Run production image locally (validates build before deploy; requires: make dev or docker compose up db -d)
	@docker rm -f $(CONTAINER_APP) 2>/dev/null || true
	@echo "Starting preview → http://localhost:3000  (Ctrl+C to stop)"
	docker run --rm \
	  --env-file .env \
	  --network blog \
	  -e DATABASE_URL=postgres://blog:blog@db:5432/blog \
	  -p 3000:3000 \
	  --name $(CONTAINER_APP) \
	  $(IMAGE_NAME)
	@echo "Preview stopped. Next: make deploy"

# -- Quality Gates -------------------------------------------------------------

test: ## Run Vitest test suite
	bun run test
	@echo "Tests complete. Next: make lint | make check"

lint: ## Run Biome linter
	bun run lint
	@echo "Lint clean. Next: make check | make format | make test"

format: ## Run Biome formatter
	bun run format
	@echo "Format applied. Next: make lint"

check: ## Run TypeScript type check (tsc --noEmit)
	bunx tsc --noEmit
	@echo "Types valid. Next: make test | git commit"

lint-tests: ## Lint e2e test annotations for 48h SLA compliance
	bun run lint:tests
	@echo "Test annotations clean. Next: make test | git commit"

e2e: test-e2e ## CI matrix alias — delegates to test-e2e

test-e2e: $(NITRO_BUNDLE) ## Run Playwright e2e test suite (auto-rebuilds nitro bundle when sources changed)
	bun run test:e2e
	@echo "E2e tests complete. Next: make lint | git commit"

audit-content: ## Run content audit and write report to docs/_reports/
	bun run audit:content
	@echo "Content audit complete. Next: make lint | git commit"

# Rebuild rule: Nitro bundle is stale when any app/scripts source file or one
# of the build inputs (package.json, bun.lock, vite.config.ts) is newer.
$(NITRO_BUNDLE): $(APP_SOURCES) package.json bun.lock vite.config.ts
	@echo "[make] sources changed — rebuilding nitro bundle..."
	bun run build

audit-fe: $(NITRO_BUNDLE) ## Run app (browser) audit; orchestrates preview server (auto-rebuilds when sources changed)
	bun run scripts/run-audit-fe.ts
	@echo "App audit complete. Next: make lint | git commit"

audit-watch: $(NITRO_BUNDLE) ## Run app audit with visible browser (headed Chromium, slow, no lighthouse) — for debugging
	AUDIT_HEADED=1 AUDIT_SLOWMO=200 bun run scripts/run-audit-fe.ts --no-lighthouse
	@echo "Visual audit complete. Next: make audit-fe (for CI mode)"

app-audit: audit-fe ## Alias for audit-fe

audit: audit-content audit-fe ## Run full audit suite (content + app) sequentially via Make targets
	@echo "Full audit complete. Next: make lint | git commit"

# -- Database ------------------------------------------------------------------

db-migrate: ## Run Drizzle migrations
	bun run db:migrate
	@echo "Migrations applied. Next: make db-seed | make dev"

db-generate: ## Generate Drizzle migration files from schema changes
	bun run db:generate
	@echo "Migration files generated. Next: make db-migrate"

db-seed: ## Seed the database with development data
	bun run db:seed
	@echo "DB seeded. Next: make db-sync | make dev"

db-sync: ## Walk app/content/posts/**/*.mdx and upsert into posts table (idempotent)
	bun run sync
	@echo "Posts indexed. Next: make dev"

db-reset: ## DESTRUCTIVE: drop schema, migrate, seed, and re-index posts (requires DB running via make dev or make dev-docker)
	docker compose exec db psql -U blog -c \
	  "DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"
	bun run db:migrate
	bun run db:seed
	bun run sync
	@echo "DB reset and posts re-indexed. Next: make dev"

# -- Container Lifecycle -------------------------------------------------------

stop: ## Stop all Docker Compose services
	docker compose down
	@echo "Services stopped. Next: make dev | make dev-docker"

restart: ## Restart DB service (native dev path)
	docker compose restart db
	@echo "DB restarted. Next: make dev | make logs"

restart-all: ## Restart all Docker Compose services
	docker compose down
	docker compose up -d
	@echo "Services restarted. Next: make logs | make dev"

logs: ## Follow app container logs
	@echo "Following app logs... (Ctrl+C to stop)"
	docker compose logs -f app

shell: ## Open interactive shell in app container
	@echo "Opening shell in app container... (type 'exit' to close)"
	docker compose exec app sh

# -- Deploy --------------------------------------------------------------------

deploy: ## Deploy to VPS (create scripts/deploy.sh to activate)
	@if test -f scripts/deploy.sh; then \
	  bash scripts/deploy.sh; \
	  echo "Deployed. Next: make logs | make preview"; \
	else \
	  echo "No deploy script found. Create scripts/deploy.sh with your VPS deploy steps."; \
	fi
