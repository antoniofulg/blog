---
status: pending
title: "Makefile: ops targets (quality gates, build, preview, db-*, lifecycle, deploy)"
type: infra
complexity: medium
dependencies:
  - task_04
---

# Task 5: Makefile: ops targets (quality gates, build, preview, db-*, lifecycle, deploy)

## Overview

Extend the `Makefile` created in task_04 with the remaining 13 targets: quality gate targets (`test`, `lint`, `format`, `check`), build and preview targets (`build`, `preview`), database targets (`db-migrate`, `db-generate`, `db-seed`, `db-reset`), container lifecycle targets (`stop`, `restart`, `logs`, `shell`), and the `deploy` stub. All targets delegate to existing `bun run` scripts or `docker compose`/`docker` commands.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `test` as `bun run test`
- MUST implement `lint` as `bun run lint`
- MUST implement `format` as `bun run format`
- MUST implement `check` as `bunx tsc --noEmit` — NOT `bun run check` (which runs Biome, not TypeScript)
- MUST implement `build` as `docker build -t $(IMAGE_NAME) .`
- MUST implement `preview` as `docker run --rm --env-file .env -p 3000:3000 --name $(CONTAINER_APP) $(IMAGE_NAME)`
- MUST implement `db-migrate`, `db-generate`, `db-seed` as delegations to `bun run db:migrate`, `bun run db:generate`, `bun run db:seed`
- MUST implement `db-reset` as: drop public schema via `docker compose exec db psql`, then `bun run db:migrate`, then `bun run db:seed`
- MUST implement `stop` as `docker compose down`
- MUST implement `restart` as `docker compose down && docker compose up -d`
- MUST implement `logs` as `docker compose logs -f app`
- MUST implement `shell` as `docker compose exec app sh`
- MUST implement `deploy` stub: checks for `scripts/deploy.sh`; runs it if present, prints instructions if absent
- MUST annotate every target with a `##` comment
- MUST NOT duplicate the `.DEFAULT_GOAL`, `.PHONY`, or variable declarations from task_04 (they are already in the Makefile)
</requirements>

## Subtasks

- [ ] 5.1 Add quality gate targets: `test`, `lint`, `format`, `check` — note `check` uses `bunx tsc --noEmit` not `bun run check`
- [ ] 5.2 Add build and preview targets: `build` uses `$(IMAGE_NAME)` variable; `preview` uses `--env-file .env`
- [ ] 5.3 Add database targets: `db-migrate`, `db-generate`, `db-seed` delegate to `bun run` scripts; `db-reset` uses `docker compose exec db psql` then migrate + seed
- [ ] 5.4 Add container lifecycle targets: `stop`, `restart`, `logs`, `shell`
- [ ] 5.5 Add `deploy` stub with `scripts/deploy.sh` existence check and fallback instructions
- [ ] 5.6 Run `make help` and confirm all 17 targets are listed with descriptions
- [ ] 5.7 Run `make test && make lint && make check` and verify all exit 0

## Implementation Details

See TechSpec "Implementation Design → Makefile — All Targets" section for the complete target implementations.

**Critical: `make check` naming collision.** `package.json` has a `check` script that runs `biome check` (lint + format combined). `make check` must call `bunx tsc --noEmit` directly. Delegating to `bun run check` would silently skip TypeScript type checking. See TechSpec "Technical Considerations → Key Decisions" section.

**`db-reset` requires DB to be running.** The target calls `docker compose exec db psql -U blog -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`. If the DB container is not running, this will fail with a clear error from docker compose. The `##` comment should note: "Requires DB to be running (`make dev` or `make dev-docker` first)".

**`deploy` stub pattern:**
```makefile
deploy: ## Deploy to VPS (create scripts/deploy.sh to activate)
	@test -f scripts/deploy.sh \
	  && bash scripts/deploy.sh \
	  || echo "No deploy script found. Create scripts/deploy.sh with your VPS deploy steps."
```
This never silently no-ops — either runs the script or prints actionable instructions.

### Relevant Files

- `Makefile` (task_04) — this task extends the existing file; skeleton, `.PHONY`, and variables are already declared
- `package.json` — `bun run test`, `bun run lint`, `bun run format`, `bun run db:migrate`, `bun run db:generate`, `bun run db:seed` all delegate to scripts in this file
- `biome.json` — `make lint` and `make format` invoke Biome via `bun run lint/format`; `make check` intentionally does NOT invoke Biome
- `tsconfig.json` — `bunx tsc --noEmit` uses this config; `strict: true`, `noEmit: true` already set
- `scripts/` directory — `db-seed` calls `bun run db:seed` which runs `scripts/seed.ts`; `deploy` checks for `scripts/deploy.sh`
- `docker-compose.yml` (task_03) — `stop`, `restart`, `logs`, `shell` call `docker compose` subcommands that reference the `app` service

### Dependent Files

- `CONTRIBUTING.md` (task_06) — documents all Makefile targets; task_06 depends on this task being complete

### Related ADRs

- [ADR-002: Full V1 Scope](adrs/adr-002.md) — all ops targets ship in this PR; no partial Makefile

## Deliverables

- All 13 ops targets added to `Makefile`
- `make help` lists all 17 targets with descriptions
- `make test && make lint && make check` exit 0
- `make build` produces a runnable image; `make preview` serves it at `localhost:3000`

## Tests

- Unit tests:
  - [ ] `make help` output contains all 17 targets: `help`, `setup`, `dev`, `dev-docker`, `test`, `lint`, `format`, `check`, `build`, `preview`, `db-migrate`, `db-generate`, `db-seed`, `db-reset`, `stop`, `restart`, `logs`, `shell`, `deploy`
  - [ ] `make test` exits 0 and invokes Vitest (output contains "PASS" or test summary)
  - [ ] `make lint` exits 0 with no lint errors on clean codebase
  - [ ] `make format` exits 0
  - [ ] `make check` exits 0 and invokes `tsc` (NOT Biome — verify output does not mention "biome")
  - [ ] `make deploy` with no `scripts/deploy.sh` prints "No deploy script found" and exits 0
  - [ ] `make deploy` with `scripts/deploy.sh` present runs the script
- Integration tests:
  - [ ] `make build` exits 0 and `docker image ls blog` shows the image
  - [ ] `make preview` starts the production image and `curl localhost:3000` returns HTTP 200
  - [ ] `make db-reset` (with DB running) drops schema, runs migrations, seeds without error
  - [ ] `make stop` stops all running compose services
  - [ ] `make logs` follows app container output (requires `make dev-docker` running in another terminal)
  - [ ] `make shell` opens an interactive shell in the app container
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `make help` lists all 17 targets — no targets missing
- `make check` invokes TypeScript (`tsc`), not Biome — confirmed by output
- `make build && make preview` validates production build locally
- `make deploy` never silently fails — either runs `scripts/deploy.sh` or prints instructions
