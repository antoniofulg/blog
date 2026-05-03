---
status: completed
title: Project Initialization and Tooling
type: infra
complexity: medium
dependencies: []
---

# Task 1: Project Initialization and Tooling

## Overview

Bootstrap the TanStack Start project using Bun and wire up all dev tooling: BiomeJS for linting and formatting, Lefthook for pre-commit hooks, Tailwind CSS with the typography plugin for styling, and a committed `.env.example` with safe local defaults. This task establishes the foundation every other task depends on — no feature work can begin until the project structure, tooling, and config files are in place and verified to work together.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST scaffold the project with `bunx create-tanstack-start@latest` using Bun as the runtime
- MUST configure `biome.json` so that `biome check .` exits 0 on a clean project
- MUST configure `.lefthook.yml` with a pre-commit hook that runs `biome check --apply`
- MUST create `.env.example` with all environment variables the project will need, pre-filled with safe local defaults (`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- MUST install and configure Tailwind CSS with `@tailwindcss/typography` plugin
- MUST configure VS Code workspace settings (`.vscode/settings.json`) to use BiomeJS as the default formatter
- MUST NOT include `node_modules` or lockfile-sensitive files in `.gitignore` exclusions that would break reproducible installs
- SHOULD pin all dependency versions in `package.json` to exact versions (no `^` or `~`) to honor the guard rail from ADR-001
</requirements>

## Subtasks

- [x] 1.1 Scaffold the TanStack Start project with Bun runtime preset (`nitro({ preset: 'bun' })` in `vite.config.ts` — new API uses vite.config.ts not app.config.ts)
- [x] 1.2 Install and configure BiomeJS — create `biome.json`, add `biome:check` and `biome:fix` scripts to `package.json`
- [x] 1.3 Install and configure Lefthook — create `lefthook.yml` (main) and `.lefthook.yml` (local override) with pre-commit hook calling `biome check --write`
- [x] 1.4 Install Tailwind CSS and `@tailwindcss/typography` — create `tailwind.config.ts` with content paths and `@plugin "@tailwindcss/typography"` in `global.css`
- [x] 1.5 Create `.env.example` with `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` pre-filled with local defaults
- [x] 1.6 Create `.vscode/settings.json` setting `"editor.defaultFormatter": "biomejs.biome"` and `"editor.formatOnSave": true`
- [x] 1.7 Verify `biome check .` exits 0 on the freshly scaffolded project

## Implementation Details

See TechSpec "Component Overview" for the full directory structure. Key files this task creates:

### Relevant Files

- `app.config.ts` — TanStack Start/Vinxi app config; set `server.preset = 'bun'`
- `biome.json` — BiomeJS linting and formatting rules
- `.lefthook.yml` — pre-commit hook configuration
- `tailwind.config.ts` — Tailwind content paths and typography plugin
- `app/styles/global.css` — Tailwind directives (`@tailwind base`, `components`, `utilities`)
- `.env.example` — committed env template with local defaults
- `.vscode/settings.json` — BiomeJS as default formatter
- `package.json` — scripts: `dev`, `build`, `biome:check`, `biome:fix`

### Dependent Files

- All subsequent tasks depend on this project structure existing
- `app/routes/__root.tsx` — created by scaffold; will be modified in task_10
- `app/router.tsx` — created by scaffold; imports Tailwind global styles

### Related ADRs

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — Guard rail: all dependency versions must be pinned in lockfile

## Deliverables

- Working TanStack Start project scaffolded with Bun runtime
- `biome.json` configured and passing on clean project
- `.lefthook.yml` with working pre-commit hook
- `tailwind.config.ts` with typography plugin
- `.env.example` with all required variables
- `.vscode/settings.json` for BiomeJS formatter
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for tooling setup **(REQUIRED)**

## Tests

- Unit tests:
  - [x] `biome check .` exits 0 on the scaffolded project with no edits
  - [x] `biome check --write` runs without error on a file with fixable formatting issues
  - [x] `tailwind.config.ts` content paths match the `app/` directory glob pattern
- Integration tests:
  - [x] `bun install` completes without errors and produces a lockfile
  - [x] Lefthook is registered: `lefthook install` exits 0
  - [x] Pre-commit hook is installed and functional (`pre-commit` hook file exists and is executable)
  - [x] `bun dev` starts the dev server and responds to `GET http://localhost:3000` (HTTP 200)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `biome check .` exits 0 on a fresh `bun install`
- `bun dev` starts without errors
- Pre-commit hook is installed and functional
