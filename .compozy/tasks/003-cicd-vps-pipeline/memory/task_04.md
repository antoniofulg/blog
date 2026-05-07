# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `.github/workflows/cd.yml` — three sequential jobs (build-push → deploy → changelog) triggered on push to main only.

## Important Decisions

- Used `(git commit -m "..." && git push)` with parentheses instead of techspec's `|| commit && push` to fix shell precedence ambiguity: `a || b && c` evaluates as `(a || b) && c`, not `a || (b && c)`.
- `GHCR_OWNER` and `GHCR_REPO` sourced from GitHub context (`github.repository_owner`, `github.event.repository.name`), not secrets — matches techspec.
- Used full `${{ github.sha }}` (40-char) per task spec; ADR-003 description of "short SHA" was illustrative in the alternatives section only.

## Learnings

- `js-yaml` CLI via npx can validate YAML when `pyyaml` module is absent.

## Files / Surfaces

- `.github/workflows/cd.yml` — created (new file)

## Errors / Corrections

- No errors encountered.

## Ready for Next Run

task_04 complete. task_05 (Repository configuration — Secrets, Ruleset, GHCR visibility) is next.
