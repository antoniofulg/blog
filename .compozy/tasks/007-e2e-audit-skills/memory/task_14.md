# Task Memory: task_14.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `.github/workflows/content-audit.yml` with `workflow_dispatch` + `pull_request` paths filter, delta suppression, PR comment, artifact upload. Add Vitest structural tests.

## Important Decisions

- Delta suppression: `suppress=true` only when blocker=0 AND major count unchanged from previous comment fingerprint. No previous comment → always comment (first run).
- Artifact upload uses `if: always()` so report is saved even when audit exits 1.
- `pull-requests: write` permission added at job level (needed by create-or-update-comment).
- Trigger format: `ci-pr-<PR_NUM>` for PRs, `manual` for workflow_dispatch (bash fallback `${PR_NUM:+ci-pr-$PR_NUM}`).

## Learnings

- `peter-evans/create-or-update-comment@v4` finds existing comment by `comment-author` + `body-includes` combo; updates in place, creates if not found.
- `grep -oP` (Perl regex) is available on Ubuntu GH runners; used to parse severity counts from audit stdout.
- `actions/github-script@v7` step with `if: github.event_name == 'pull_request'` correctly skips on workflow_dispatch.

## Files / Surfaces

- `.github/workflows/content-audit.yml` — new workflow (leaf in dep graph)
- `app/tests/content-audit-workflow.test.ts` — 19 Vitest structural tests (all pass)

## Errors / Corrections

- `getPostInventory()` queries Postgres; workflow needs a real DB service. Added Postgres service container + `bun run db:migrate` step. ADR-002 "no PGLite required" means no PGLite test harness, but a real Postgres service IS needed.
- DATABASE_URL passed via step `env:` to override the placeholder in `.env.example`.

## Ready for Next Run

Task complete. Postgres service + migrations added to workflow. 19 tests pass. Commit ready.
