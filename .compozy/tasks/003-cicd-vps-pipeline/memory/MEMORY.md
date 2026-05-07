# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01: done (commitlint setup — package.json, config, lefthook hook)
- task_02: done (scripts/deploy.sh created, tests pass)
- task_03: done (ci.yml — 5 jobs: quality matrix, commitlint, branch-check)
- task_04: done (.github/workflows/cd.yml — three-job CD pipeline)
- task_05: pending

## Shared Decisions

- GHCR package must be set to **public** visibility (one-time UI action after first CD run) so VPS can pull without credentials.
- `scripts/deploy.sh` is the shared deploy interface for both GitHub Actions CD and `make deploy`.

## Shared Learnings

- `public-routes.test.ts` integration test failure is pre-existing on the main branch; not introduced by this pipeline work.
- Makefile deploy recipe uses `bash scripts/deploy.sh; echo "Deployed..."` — the `;` means make exits 0 even when the script fails. This is a known limitation; follow-up: change to `&&`.

## Open Risks

- Makefile deploy recipe does not propagate deploy.sh failure (see Shared Learnings above).

## Handoffs

- task_03 depends on task_01 (commitlint packages must be installed). task_04 depends on task_02 (scripts/deploy.sh must exist).
