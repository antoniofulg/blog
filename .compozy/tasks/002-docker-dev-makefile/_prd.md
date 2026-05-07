# PRD: Dockerized Dev Environment + Makefile

## Overview

The blog project currently requires contributors to install Bun and configure a local Postgres instance before running anything — four to five invisible friction points before writing a single line of code. This feature introduces a Makefile as the single developer interface and Docker containerization for the app, collapsing fresh clone to working dev environment into two commands: `make setup && make dev`.

**Who it is for:** Open-source contributors discovering the project for the first time, and the project author returning after extended gaps in activity.

**Why it is valuable:** Every extra setup step is a dropout event. A self-documenting Makefile and reproducible container environment permanently eliminate environment reconstruction cost and lower the barrier for first-time contributors.

---

## Goals

- **Contributor onboarding time**: Fresh clone to running app in under 3 minutes on a machine with Docker Desktop installed
- **Setup commands required**: ≤ 2 commands documented in CONTRIBUTING.md
- **Contributor setup issues**: 0 GitHub Issues labeled `setup` or `onboarding` per month after launch
- **CI coverage**: `make test`, `make lint`, `make build` validated on every PR
- **Hot reload round-trip** (native dev): under 2 seconds from file save to browser update

---

## User Stories

### Open-source contributor (new)

- As a new contributor, I want to run a single setup command after cloning so that I can start contributing without installing runtime dependencies manually.
- As a new contributor, I want a `make help` output that lists every available developer action so that I don't need to read `package.json` to understand the workflow.
- As a new contributor, I want `make test` and `make lint` to work identically locally and in CI so that my PR does not fail on issues I couldn't catch locally.

### Project author (returning)

- As the project author returning after a long gap, I want `make setup` to reconstruct my dev environment from scratch so that I don't need to remember the right sequence of manual steps.
- As the project author, I want `make build && make preview` to validate the production image locally so that I can catch build-time issues before deploying.
- As the project author, I want `make deploy` to call my VPS deployment workflow so that deploying is a single documented command.

### Advanced contributor (environment parity)

- As a contributor who wants full CI parity, I want `make dev-docker` to run the complete app stack in containers so that I can verify behavior matches the production environment.

---

## Core Features

### F1 — Makefile with `help` target (Critical)

The Makefile is the single entry point for all developer actions. `make help` is the default goal — running `make` with no arguments prints a formatted list of all targets with their descriptions, scraped from `##` comments on each target. All targets are declared `.PHONY`. No logic lives in the Makefile that already exists in `package.json` scripts; targets delegate to existing scripts.

### F2 — `make setup` — first-clone onboarding (Critical)

Copies `.env.example` to `.env` if no `.env` file exists, validates that `DATABASE_URL` has been changed from the default placeholder, pulls required Docker images, starts the database container, and runs migrations. Completes without any manual intervention on a machine with Docker Desktop installed. Does **not** seed the database — contributors control seeding via `make db-seed`.

### F3 — `make dev` — native dev workflow (Critical)

Starts Postgres via Docker Compose, then runs `bun dev` on the host. Hot reload is confirmed working. This is the default dev path — fast feedback loop, no container overhead on the app process. Native Bun on the host is the default because Docker's file-event propagation on macOS has documented reliability issues with Bun (see ADR-001).

### F4 — Multi-stage production Dockerfile (Critical)

Two-stage build: builder stage installs all dependencies and runs `vite build`; runner stage copies only `.output/` and production dependencies. No build secrets in image layers. Bun runtime throughout. The resulting image is the artifact used by `make build`, `make preview`, and `make deploy`.

### F5 — `make dev-docker` — containerized dev (High)

Full Docker Compose stack using `develop: watch:` sync blocks. Opt-in alternative for contributors who want CI environment parity. `make help` documents macOS hot-reload caveats. Not the default because reliability of file-sync on macOS is platform-dependent.

### F6 — Database targets (High)

| Target | Action |
|--------|--------|
| `make db-migrate` | Runs Drizzle migrations |
| `make db-generate` | Generates migration files from schema |
| `make db-seed` | Runs `scripts/seed.ts` |
| `make db-reset` | Drops, migrates, and seeds in sequence |

Each target delegates to the corresponding `bun run` script. No direct SQL or Drizzle CLI calls in the Makefile.

### F7 — Quality gate targets (High)

| Target | Tool |
|--------|------|
| `make test` | Vitest |
| `make lint` | Biome lint |
| `make format` | Biome format |
| `make check` | TypeScript type check |

All four targets run identically locally and in CI. No divergence between local and pipeline invocation.

### F8 — Build and preview targets (Medium)

`make build` builds the production Docker image using the multi-stage Dockerfile. `make preview` runs that image locally with environment variables from `.env`, allowing the author to validate the production build before deploying. Acts as a manual smoke test gate.

### F9 — Container lifecycle targets (Medium)

| Target | Action |
|--------|--------|
| `make stop` | Stops all compose services |
| `make restart` | Stops then starts all services |
| `make logs` | Follows app container log output |
| `make shell` | Opens an interactive shell in the app container |

Daily container management without memorizing Docker Compose commands.

### F10 — `make deploy` stub (Medium)

Calls a VPS deployment workflow (SSH + Docker pull, rsync, or a `deploy.sh` script). In V1, the target prints deployment instructions if no deploy script exists, ensuring `make help` always shows a deploy option. The actual VPS tooling is wired up at implementation time based on the specific hosting configuration.

---

## User Experience

### First-clone flow

1. Contributor clones the repository.
2. Runs `make setup` — `.env` is created, DB starts, migrations run. Output confirms each step.
3. Runs `make dev` — browser opens at `localhost:3000`.
4. Total time: under 3 minutes on a machine with Docker Desktop.

### Daily dev loop

1. `make dev` — start working.
2. Edit files — hot reload updates the browser within 2 seconds.
3. `make test` — run tests before committing.
4. `make lint && make format` — quality gates pass.
5. `git commit && git push`.

### Discovery

- `make help` (or just `make`) shows all available targets with one-line descriptions.
- Every target's `##` comment is the canonical documentation — no separate wiki page to maintain.
- CONTRIBUTING.md references `make help` as the starting point, not a long setup guide.

### Production validation

1. `make build` — builds the prod image.
2. `make preview` — runs it locally, verifies the app works.
3. `make deploy` — deploys to VPS.

---

## High-Level Technical Constraints

- Docker Desktop must be installed; the feature does not support Docker-free environments.
- `make dev` (native path) requires Bun installed on the host; `make dev-docker` does not.
- Client-side environment variables (`VITE_*`) are baked into the image at build time; server-side variables are injected at container runtime. `make build` must receive any required `VITE_*` values.
- The Makefile must be POSIX-compatible. Windows contributors must use WSL2 or Docker Desktop with Linux containers.
- The `.env.example` file is the authoritative list of required environment variables. `make setup` validates presence and non-default values.

---

## Non-Goals (Out of Scope)

- **`.devcontainer/` spec** — GitHub Codespaces and VS Code Dev Container support is V2; adds complexity and targets a different contributor persona (browser-based vs. local).
- **CI/CD pipeline changes** — wiring `make test` / `make build` into GitHub Actions is a separate task; V1 only ensures targets are compatible with CI invocation.
- **Windows native support** — POSIX Makefile; Windows contributors use WSL2 or Docker Desktop.
- **Secrets management beyond `.env`** — Vault, Doppler, 1Password out of scope; `.env.example` + local `.env` is sufficient for a personal blog.
- **Kubernetes or multi-replica deploy** — `make deploy` targets a single-container VPS deployment.
- **Database seeding in `make setup`** — contributors control seeding via `make db-seed`; auto-seed on setup is not appropriate for all contributor contexts.
- **Application code changes** — this feature touches only developer tooling (Makefile, Dockerfile, docker-compose.yml, .env.example); no changes to app logic, routes, or schema.

---

## Phased Rollout Plan

### Phase 1 — MVP

Deliver all ten feature groups in a single PR:

- Makefile with `help`, `setup`, `dev`, `dev-docker`, `build`, `preview`, `db-*`, quality gates, lifecycle targets, `deploy` stub
- Multi-stage production Dockerfile
- Extended `docker-compose.yml` with app service and `develop: watch:` blocks
- CONTRIBUTING.md with two-command onboarding flow

**Success criteria to proceed:** `make setup && make dev` works on a fresh clone with Docker Desktop. `make build` produces a runnable image. `make test && make lint` pass.

### Phase 2 — CI Integration

- Add GitHub Actions workflow that runs `make test`, `make lint`, `make check`, `make build` on every PR.
- Validate that no CI step requires anything beyond Docker Desktop (i.e., no host-installed Bun in CI).

**Success criteria:** CI green on all PRs; no contributor setup issues filed in the first 30 days after launch.

### Phase 3 — V2 Enhancements (Post-MVP)

- `.devcontainer/` spec for VS Code Dev Containers and GitHub Codespaces — one-click browser-based contribution with zero local install.
- Resolve `make dev` once Bun macOS Docker file-event issue (oven-sh/bun#9300) is fixed upstream; consider making containerized dev the default.
- Expand `make deploy` to a full VPS deploy script with health check and rollback.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Fresh-clone to running app | < 3 minutes | Time `make setup && make dev` on a clean machine with Docker Desktop |
| Setup commands required | ≤ 2 | Count commands in CONTRIBUTING.md onboarding section |
| Contributor setup issues | 0 / month | GitHub Issues labeled `setup` or `onboarding` |
| Make targets with CI validation | 100% of quality gates | CI runs `make test`, `make lint`, `make check`, `make build` on every PR |
| Hot reload round-trip | < 2 seconds | Manual: save file, observe HMR update in browser |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `make dev-docker` hot reload unreliable on macOS | High | Medium | Native dev is default; containerized dev is opt-in. `make help` documents `CHOKIDAR_USEPOLLING` fallback. |
| Contributors conflate `make dev` vs `make dev-docker` | Medium | Low | Distinct `make help` descriptions; CONTRIBUTING.md explains both paths. |
| `make deploy` VPS stub not wired up | Medium | Medium | Stub prints instructions if no deploy script exists; never silently no-ops. |
| `.env` with default values causes hard-to-diagnose DB errors | Medium | High | `make setup` validates `DATABASE_URL` is not the default placeholder value and fails early with a clear message. |
| Makefile becomes stale as scripts evolve | Low | Medium | CI validates `make test`, `make lint`, `make build` on every PR — stale targets are caught in CI. |

---

## Architecture Decision Records

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `make dev` runs Bun natively; `make dev-docker` is the opt-in full-stack container target
- [ADR-002: Full V1 Scope — Complete Makefile + Dockerfile in Single Delivery](adrs/adr-002.md) — All 10 target groups ship together; partial Makefile rejected as leaky abstraction

---

## Open Questions

- What is the exact VPS deployment mechanism? (SSH + `docker pull` + `docker run`? `rsync` + restart? A `deploy.sh` script already on the server?) — determines what `make deploy` actually calls.
- Should `make setup` auto-start the database in the background (`-d`) or in the foreground with visible output? Background is more ergonomic; foreground helps debug startup issues.
