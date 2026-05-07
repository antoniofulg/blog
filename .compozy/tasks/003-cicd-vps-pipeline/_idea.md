# Idea: CI/CD Pipeline + Branch & Commit Standards

## Overview

A production-ready CI/CD system that automates testing, building, and deploying the blog to a VPS on every merge to `main`. Pairs the automation with enforced Conventional Commits and TASK-prefix branch naming that tie every code change back to a compozy task. An auto-generated changelog surfaces the full release history from structured commit messages.

## Problem

The blog has no automated deployment or quality gate. Every deploy is manual — the developer runs Makefile commands locally, introducing human error and friction. There is no enforcement of code quality before changes reach production, no structured commit history, and no traceability between branches and the task system.

**Market context:** According to GitLab's 2024 DevSecOps survey, teams with automated CI/CD deploy 5× more frequently and have 50% fewer production failures than those relying on manual processes. For a solo developer, CI/CD is the most leveraged single investment in operational reliability.

## Core Features

| # | Feature | Priority | Description |
|---|---|---|---|
| F1 | GitHub Actions CI | Critical | On every push/PR: `make test && make lint && make check`. Blocks merges on failure. |
| F2 | GitHub Actions CD | Critical | On push to `main`: build Docker image (runner stage) → push to GHCR → SSH to VPS → `make db-migrate` → restart app container with `docker compose up -d --no-deps`. |
| F3 | Conventional Commits enforcement | High | `commitlint` in Lefthook `commit-msg` hook (local) + GitHub Actions workflow that lints all commits in a PR (remote). Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`. |
| F4 | TASK-prefix branch naming | High | Pattern: `TASK-XXXX/short-description` (e.g., `TASK-0003/cicd-vps-pipeline`). Enforced by GitHub Ruleset (native, no YAML) and validated in CI on PR open. |
| F5 | Auto-changelog | High | On every merge to `main`, `conventional-changelog-cli` appends to `CHANGELOG.md` from structured commit history. Committed back to `main` automatically. |
| F6 | Migration-first deploy | Critical | Deploy step sequence: (1) SSH → `make db-migrate` → (2) `docker compose up -d --no-deps app`. Migration failures abort deploy before container restart. |

## KPIs

| KPI | Target | Measurement |
|---|---|---|
| Push-to-live latency | < 5 minutes | Time from `git push main` to container healthy on VPS |
| Failed deploys due to broken build | 0 | CI must pass before deploy step triggers |
| Commit message violations reaching `main` | 0 | Blocked by hook + CI check |
| Non-conforming branches created | 0 | Blocked by GitHub Ruleset |
| Changelog entries per release | 1:1 with `main` merges | Auto-generated, zero manual effort |
| Setup time on fresh GitHub Actions config | ≤ 4 GitHub Secrets to set | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` |

## Feature Assessment

| Criteria | Score | Reasoning |
|---|---|---|
| Impact | Must do | Eliminates manual deploy risk permanently |
| Reach | Must do | Every commit from this point forward is affected |
| Frequency | Strong | Triggered on every push to main — daily touchpoint |
| Differentiation | Strong | TASK-prefix tied to compozy tasks is non-standard; creates full traceability chain unique to this project |
| Defensibility | Maybe | Workflows are portable; the compozy integration pattern compounds as task count grows |
| Feasibility | Must do | All building blocks exist (Makefile, Dockerfile, Lefthook, Bun, Docker); zero new infra required beyond VPS SSH access |

## Council Insights

**Agreements:** All advisors agreed the core pipeline (test → build → deploy) is unambiguously valuable and should ship without delay.

**Key tension:** Pragmatic Engineer and Product Mind argued commitlint and branch naming are ceremony for a single-author project that adds friction with no consumer. Architect Advisor countered that the traceability value compounds over time only if conventions are established from the first commit, not retrofitted later.

**Resolution:** User explicitly requested both features; include them. Mitigate the friction concern by using GitHub Rulesets (native, no extra YAML) for branch enforcement and keeping the `git commit --no-verify` bypass documented for emergency hotfixes.

**Critical gap surfaced by Architect:** No one proposed a migration step before container restart — the most common source of silent production failures. Added as F6 (Migration-first deploy), now a critical feature.

**Dropped:** `docker-rollout` for zero-downtime is overkill for a personal blog. `docker compose up -d --no-deps` achieves acceptable restart time (<10s) without the extra dependency.

## Out of Scope (V1)

| Item | Reason |
|---|---|
| Renaming existing compozy task folders to TASK-prefix | Separate refactoring task; mixing concerns inflates scope and risks half-finished state |
| Staging / preview environment | Requires second VPS or service; adds infra overhead disproportionate to a personal blog |
| Zero-downtime with docker-rollout | Overkill — a personal blog has no SLA. `docker compose up -d --no-deps` is sufficient |
| Slack / email deploy notifications | GitHub Actions UI provides deploy status with zero setup |
| Auto-rollback on health check failure | V2 concern — adds complexity before VPS is proven stable |
| Semantic versioning / release tagging | Valuable once changelog is established; add when the project has external consumers |

## Architecture Decision Records

- [ADR-001: CI/CD V1 Scope — Pipeline-First, Standards-Included](adrs/adr-001.md) — Full scope confirmed including conventions and changelog; docker-rollout and folder rename deferred

## Open Questions

- Should the `commit-msg` hook document a bypass path (`git commit --no-verify`) for emergency hotfixes, or enforce hard-block always?
- What is the VPS OS and does the deploy user already exist in the `docker` group? (Required for `docker compose` to run without `sudo`)
- Should the `CHANGELOG.md` auto-commit use `[skip ci]` in its commit message to avoid triggering a recursive pipeline?
- Should F4 (branch naming) allow `main`, `release/*`, and `hotfix/*` as exempt patterns from the TASK prefix rule?
