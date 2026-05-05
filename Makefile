.DEFAULT_GOAL := help
.PHONY: help setup dev dev-docker build preview \
        test lint format check \
        db-migrate db-generate db-seed db-reset \
        stop restart logs shell deploy

IMAGE_NAME    ?= blog
CONTAINER_APP ?= blog-app

# -- Discovery -----------------------------------------------------------------

help: ## Show available targets
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z_-]+:.*?##/ \
	  { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# -- Onboarding ----------------------------------------------------------------

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

# -- Development ---------------------------------------------------------------

dev: ## Start native Bun dev server with Postgres in Docker (default)
	docker compose up db -d
	bun dev

dev-docker: ## Start fully containerized stack with file sync (opt-in; macOS HMR may vary)
	docker compose watch

# -- Build & Preview -----------------------------------------------------------

build: ## Build production Docker image
	docker build -t $(IMAGE_NAME) .

preview: ## Run production image locally (validates build before deploy)
	docker run --rm --env-file .env -p 3000:3000 --name $(CONTAINER_APP) $(IMAGE_NAME)

# -- Quality Gates -------------------------------------------------------------

test: ## Run Vitest test suite
	bun run test

lint: ## Run Biome linter
	bun run lint

format: ## Run Biome formatter
	bun run format

check: ## Run TypeScript type check (tsc --noEmit)
	bunx tsc --noEmit

# -- Database ------------------------------------------------------------------

db-migrate: ## Run Drizzle migrations
	bun run db:migrate

db-generate: ## Generate Drizzle migration files from schema changes
	bun run db:generate

db-seed: ## Seed the database with development data
	bun run db:seed

db-reset: ## DESTRUCTIVE: drop schema, migrate, and seed (requires DB running via make dev or make dev-docker)
	docker compose exec db psql -U blog -c \
	  "DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"
	bun run db:migrate
	bun run db:seed

# -- Container Lifecycle -------------------------------------------------------

stop: ## Stop all Docker Compose services
	docker compose down

restart: ## Restart all Docker Compose services
	docker compose down && docker compose up -d

logs: ## Follow app container logs
	docker compose logs -f app

shell: ## Open interactive shell in app container
	docker compose exec app sh

# -- Deploy --------------------------------------------------------------------

deploy: ## Deploy to VPS (create scripts/deploy.sh to activate)
	@test -f scripts/deploy.sh \
	  && bash scripts/deploy.sh \
	  || echo "No deploy script found. Create scripts/deploy.sh with your VPS deploy steps."
