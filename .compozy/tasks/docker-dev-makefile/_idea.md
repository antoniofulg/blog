# Dockerized Dev Environment + Makefile

## Overview

Containerize the blog's development and production environments and introduce a Makefile as the single interface for all development actions. The blog currently runs Postgres in Docker but the app itself runs natively. Contributors must install Bun and Postgres locally before they can run anything.

This feature targets open-source contributors — developers who want to contribute but face environment setup friction. It also benefits the author on new machines or after long gaps in activity. V1 scope is full platform: dev workflow, build pipeline, quality gates, database operations, first-clone setup, and a deploy stub.

## Problem

Any developer who clones this repository today must: install Bun (a runtime they may never have used), configure a local Postgres instance, set credentials, and resolve any environment conflicts with their existing setup. That is four to five invisible friction points before writing a single line of code.

Research on open-source contribution funnels is clear: every setup step that requires external knowledge or a non-trivial install is a dropout event. Onboarding time directly correlates with contribution volume — every extra manual step loses potential contributors. The project currently offers no Makefile, no app Dockerfile, and no documented first-clone workflow. Contributors must read scattered `package.json` scripts and figure out the right order to run them.

For the author, the cost is also real. After a machine upgrade, a new laptop, or a six-month gap in activity, the local environment needs to be reconstructed from memory. A reproducible, documented setup eliminates that reconstruction cost permanently.

### Market Data

- Docker reduces contributor onboarding friction more than any other single DX investment, collapsing "works on my machine" problems and replacing multi-step setup guides with a single command.
- Good open-source projects in 2025–2026 treat `make help` as a standard convention — a scraped-comment help system that surfaces all available targets. Contributors now expect this.
- `docker compose watch` (Docker Desktop 4.24+) provides first-class file sync with framework HMR, resolving the previously problematic bind-mount file-event propagation on macOS.
- TanStack Start with Bun as the server runtime has proven multi-stage Docker build patterns (builder + runner stages), with the critical constraint that React 19 is required for SSR.

## Core Features

| #  | Feature | Priority | Description |
|----|---------|----------|-------------|
| F1 | Makefile with `help` target | Critical | Thin Makefile wrapping all dev actions. `make help` scrapes `##` comments to list all targets. Default goal is `help`. All targets declared `.PHONY`. |
| F2 | `make setup` — first-clone onboarding | Critical | Copies `.env.example` → `.env`, validates required vars, pulls Docker images, starts DB container, runs migrations. Collapses fresh clone to working state in one command. |
| F3 | `make dev` — native dev workflow | Critical | Starts Postgres via compose, then runs `bun dev` natively. Hot reload confirmed working. Fast feedback loop guaranteed. |
| F4 | Multi-stage production Dockerfile | Critical | Stage 1 (builder): installs deps + runs `vite build`. Stage 2 (runner): copies `.output/` + prod deps only. No secrets in layers. Bun runtime. |
| F5 | `make dev-docker` — containerized dev | High | Full compose stack with `develop: watch:` sync blocks. Opt-in alternative for contributors wanting CI parity. Documented macOS caveats in `make help`. |
| F6 | Database targets | High | `make db-migrate`, `make db-generate`, `make db-seed`, `make db-reset` — each delegates to the corresponding `bun run` script inside the appropriate environment. |
| F7 | Quality gate targets | High | `make test` (Vitest), `make lint` (Biome), `make format` (Biome format), `make check` (type check). All runnable locally and in CI identically. |
| F8 | Build + preview targets | Medium | `make build` builds the prod image. `make preview` runs the prod image locally. Validates the build before any deploy. |
| F9 | Container lifecycle targets | Medium | `make stop`, `make restart`, `make logs`, `make shell` (exec into app container). Daily container management without memorizing compose commands. |
| F10 | `make deploy` stub | Medium | Placeholder target that prints deployment instructions or calls a deploy script. Actual implementation depends on hosting target (Fly.io, Railway, Cloud Run). |

## KPIs

| KPI | Target | How to Measure |
|-----|--------|----------------|
| Fresh-clone to running app | < 3 minutes | Time `make setup && make dev` on a clean machine with Docker Desktop installed |
| Setup commands required | ≤ 2 commands | Count commands in CONTRIBUTING.md onboarding section |
| Contributor setup issues | 0 per month | GitHub Issues labeled `setup` or `onboarding` |
| Make targets with CI validation | 100% | CI pipeline runs `make test`, `make lint`, `make build` on every PR |
| Hot reload round-trip (native) | < 2s | Manual timing: save a file, observe HMR update in browser |

## Feature Assessment

| Criteria | Question | Score |
|----------|----------|-------|
| **Impact** | How much more valuable does this make the product? | Strong — eliminates the #1 contributor friction point |
| **Reach** | What % of users would this affect? | Must do — affects 100% of developers (author + all contributors) |
| **Frequency** | How often would users encounter this value? | Must do — used every single dev session |
| **Differentiation** | Does this set us apart or just match competitors? | Maybe — common in well-maintained projects, but quality of execution differentiates |
| **Defensibility** | Is this easy to copy or does it compound over time? | Maybe — not compounding, but raises the permanent baseline quality |
| **Feasibility** | Can we actually build this? | Must do — well-understood technology, clear implementation path |

Leverage type: **Quick Win** — medium effort, disproportionate value for contributors and author alike.

## Council Insights

- **Recommended approach**: Native-first dev workflow (`make dev` = Bun on host) with containerized dev as opt-in (`make dev-docker`). Makefile is thin wrappers only — no duplicated logic from `package.json`. Multi-stage prod Dockerfile is low-risk and high-value.
- **Key trade-offs**:
  - Native dev guarantees hot reload reliability; container dev maximizes environment parity — V1 ships both, native as default
  - Makefile as living documentation vs. maintenance contract — mitigated by CI validating key targets on every PR
  - Build-time vs. runtime env var boundary in Dockerfile — client-side `VITE_*` vars baked at build time, server-side vars injected at runtime
- **Risks identified**:
  - Bun macOS file-event issue (#9300) affects `docker compose watch` behavior — mitigated by making containerized dev opt-in and documenting polling fallback
  - Anonymous volumes required to isolate bun deps from host bind mounts — silent failure mode if omitted
  - `app` service must declare `depends_on: db: condition: service_healthy` to prevent race with auto-migration at server start
  - Secrets in Dockerfile `ARG`/`ENV` — mitigated by never passing secrets to builder stage; runtime env only in runner stage
- **Stretch goal (V2+)**: `.devcontainer/` spec for VS Code Dev Containers + GitHub Codespaces — one-click browser-based contribution with zero local install required.

## Integration with Existing Features

| Integration Point | How |
|---|---|
| `docker-compose.yml` (Postgres) | Extend with `app` service and `develop: watch:` blocks; existing `db` service and volume unchanged |
| `package.json` scripts | Makefile delegates to existing scripts — no duplication; `make db-migrate` calls `bun run db:migrate` |
| `drizzle.config.ts` | No changes; Makefile wraps existing Drizzle CLI commands |
| `.env` / `.env.example` | `make setup` uses `.env.example` as source of truth; validates `DATABASE_URL` is not default value |
| Vite `configureServer` hook | Runs auto-migrate + seed at dev server start; must ensure DB is ready before app starts (compose healthcheck) |

## Out of Scope (V1)

- **`.devcontainer/` spec** — GitHub Codespaces/Dev Container integration is the logical V2; adds significant complexity and is a separate contributor persona (browser-based vs. local)
- **CI/CD pipeline changes** — Integrating the Makefile into GitHub Actions is a separate task; V1 only ensures targets are compatible with CI invocation
- **Windows native support** — Makefile assumes POSIX shell; Windows contributors must use WSL2 or Docker Desktop. Not worth the complexity in V1.
- **Secrets management beyond `.env`** — Vault, Doppler, or 1Password integration is out of scope; `.env.example` + local `.env` is sufficient for a personal blog
- **Kubernetes / multi-replica deploy** — Deploy stub targets a single-container hosting platform (Fly.io, Railway, or Cloud Run)
- **View counter implementation** — `viewCount` column exists in the schema but increment logic is a separate feature; this idea does not touch application code

## Architecture Decision Records

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `make dev` runs Bun natively; `make dev-docker` is the opt-in full-stack container target

## Open Questions

- What is the deploy target? (Fly.io, Railway, Cloud Run, VPS?) — determines what `make deploy` actually calls
- Should `make setup` also seed the database, or only migrate? (seeding may not be appropriate in all contributor contexts)
- Is there a `.env.example` file already, or does one need to be created as part of this feature?
- Should `make dev` also auto-start the DB container, or require contributors to run `make db-start` separately? (auto-start is more ergonomic but hides the dependency)
