---
status: completed
title: Create multi-stage `Dockerfile`
type: infra
complexity: medium
dependencies:
  - task_01
---

# Task 2: Create multi-stage `Dockerfile`

## Overview

Create a three-stage `Dockerfile` at the project root with named stages `dev`, `builder`, and `runner`. The `dev` stage is used by the docker-compose `app` service for `make dev-docker`. The `builder` stage produces the `.output/` bundle. The `runner` stage is the minimal production image used by `make build` and `make preview`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST use `oven/bun:1` as base for `dev` and `builder` stages
- MUST use `oven/bun:1-alpine` as base for `runner` stage (smaller production image)
- MUST install deps in `dev` stage using `bun install --frozen-lockfile` before any source COPY
- MUST copy `.output/` from builder into runner — no source files in production image
- MUST set `NODE_ENV=production` in runner stage
- MUST expose port 3000
- MUST NOT copy `.env` or secrets into any stage (`.dockerignore` from task_01 handles this)
- SHOULD verify the Nitro bun preset output path — expected `bun .output/server/index.mjs`; update CMD if path differs after first build
</requirements>

## Subtasks

- [x] 2.1 Write `dev` stage: `FROM oven/bun:1`, WORKDIR `/app`, COPY `package.json bun.lock`, `RUN bun install --frozen-lockfile`, `CMD ["bun", "dev", "--port", "3000"]`
- [x] 2.2 Write `builder` stage: `FROM dev AS builder`, `COPY . .`, `RUN bun run build`
- [x] 2.3 Write `runner` stage: `FROM oven/bun:1-alpine`, WORKDIR `/app`, `ENV NODE_ENV=production`, `COPY --from=builder /app/.output ./.output`, `EXPOSE 3000`, `CMD ["bun", ".output/server/index.mjs"]`
- [x] 2.4 Run `docker build -t blog .` and verify the runner image starts with `docker run --rm --env-file .env -p 3000:3000 blog`
- [x] 2.5 Confirm `.output/server/index.mjs` is the correct entry point — update CMD if Nitro outputs a different path

## Implementation Details

See TechSpec "Implementation Design → Dockerfile Stages" section for the exact stage definitions and the note on verifying the Nitro bun preset output path.

The `vite.config.ts` uses `nitro({ preset: "bun" })`. Nitro bun preset outputs to `.output/`. The exact entry file name (`index.mjs` vs `index.ts`) must be verified after the first `bun run build` inside the builder stage. Run `docker run --rm blog ls .output/server/` to inspect.

The `dev` stage installs all dependencies (including devDependencies) because `bun dev` requires them. The `runner` stage does not reinstall deps — Nitro bundles everything into `.output/`, making the runner stage fully self-contained.

### Relevant Files

- `.dockerignore` (task_01) — must exist before `COPY . .` in builder stage to exclude `node_modules` and `.env`
- `package.json` — defines `build` script (`vite build`); `bun run build` calls this
- `bun.lock` — locked dependency manifest; `--frozen-lockfile` enforces it
- `vite.config.ts` — defines Nitro bun preset and build output; determines `.output/` structure
- `.env.example` — reference for which vars are needed at runtime (passed via `--env-file` at container start, not baked in)

### Dependent Files

- `docker-compose.yml` (task_03) — `app` service references `build: target: dev` from this Dockerfile
- `Makefile` (task_04, task_05) — `make build` calls `docker build -t blog .`; `make preview` calls `docker run --env-file .env -p 3000:3000 blog`

### Related ADRs

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `dev` stage enables `make dev-docker`; `runner` stage enables `make build`
- [ADR-003: Multi-Stage Dockerfile with Named Build Targets](adrs/adr-003.md) — defines the three-stage strategy and base image choices

## Deliverables

- `Dockerfile` at project root with `dev`, `builder`, and `runner` named stages
- Verified production image starts and serves the app on port 3000
- Smoke test confirming `.output/server/index.mjs` (or corrected path) is the entry point

## Tests

- Unit tests:
  - [x] `docker build --target dev -t blog-dev .` exits 0
  - [x] `docker build --target builder -t blog-builder .` exits 0 and `.output/` directory is populated
  - [x] `docker build -t blog .` (runner stage) exits 0
  - [x] Runner image size is under 500 MB (`docker image ls blog`)
- Integration tests:
  - [x] `docker run --rm --env-file .env -p 3000:3000 blog` starts and `curl localhost:3000` returns HTTP 200
  - [x] `docker run --rm blog ls .output/server/` shows the entry file (confirm CMD path is correct)
  - [x] No `node_modules` directory present in runner image (`docker run --rm blog ls /app/`)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `docker build -t blog .` exits 0 within 3 minutes on warm cache
- Production image runs the app at `localhost:3000` with correct env vars
- No source files, devDependencies, or `.env` secrets in runner image layers
