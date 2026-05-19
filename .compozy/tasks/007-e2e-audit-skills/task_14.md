---
status: completed
title: content-audit GH Action with delta PR comment
type: infra
complexity: low
dependencies:
    - task_13
feature: audit/ci-workflow
---

# Task 14: content-audit GH Action with delta PR comment

## Overview

Create `.github/workflows/content-audit.yml` that triggers on `workflow_dispatch` (manual) and `pull_request` with a `paths` filter on `app/content/posts/**` + `app/db/schema.ts`. The workflow runs `bun run audit:content`, uploads the per-run report as an artifact, and posts a PR comment with severity counts + top blockers + artifact link via `peter-evans/create-or-update-comment@v4`. The comment uses a hidden fingerprint for delta-only suppression — if the new run's `blocker` count is 0 AND `major` count is unchanged from the previous comment, the workflow skips re-commenting.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `.github/workflows/content-audit.yml` with:
  - Triggers: `workflow_dispatch` + `pull_request` with `paths: ['app/content/posts/**', 'app/db/schema.ts']`.
  - Job steps: checkout → setup-bun (1.3.13) → `bun install --frozen-lockfile` → `bun run audit:content --trigger=ci-pr-${{ github.event.pull_request.number }}` → upload artifact.
  - PR comment step using `peter-evans/create-or-update-comment@v4` with `comment-author: github-actions[bot]`, `body-includes: <!-- audit-fingerprint -->`.
- MUST embed a hidden HTML comment fingerprint (`<!-- audit-fingerprint:blocker=X major=Y -->`) inside the PR comment body for delta detection.
- MUST suppress the PR comment when the current run's `blocker` count is 0 AND `major` count is unchanged from the previous comment on the same PR.
- MUST upload `docs/_reports/content-audit-*.md` as a GHA artifact named `content-audit-report-${{ github.run_id }}`.
- MUST NOT block PR merge (this workflow is informational; the e2e job from task_07 is the gate).
- MUST NOT run on PRs that don't touch the path-filtered files (zero-cost for unrelated PRs).
</requirements>

## Subtasks

- [x] 14.1 Create `.github/workflows/content-audit.yml` with triggers, jobs, and steps.
- [x] 14.2 Implement the delta-comparison logic (read previous comment via `gh api` or `actions/github-script` querying `pulls/<n>/comments`, parse fingerprint, compare).
- [x] 14.3 Add fingerprint embedding to the PR comment body.
- [x] 14.4 Add Vitest test parsing the YAML workflow file to assert structural invariants.

## Implementation Details

See TechSpec "Build Order step 34" and PRD-007 Phased Rollout Plan ("PR comment + committed summary row"). The `peter-evans/create-or-update-comment@v4` action updates an existing comment when `body-includes` matches; this is how we maintain a single rolling comment per PR. The fingerprint format encodes severity counts in a parseable way so the workflow can detect "no signal change" without parsing the whole body.

### Relevant Files

- `.github/workflows/ci.yml` — reference for setup-bun + checkout pattern.
- `.github/workflows/cd.yml` — reference for action versions + secrets injection.
- `scripts/audit-content.ts` (task_13) — the script the workflow invokes.
- `docs/_reports/content-audit-*.md` — generated per run; uploaded as artifact.

### Dependent Files

- None — this is a leaf in the dependency graph (consumes the CLI, doesn't expose anything to downstream tasks beyond the deployed workflow).

### Related ADRs

- [ADR-002: Pivot audit skill from browser-sweep to content-audit](../adrs/adr-002.md) — defines the audit's CI integration shape.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 3 + audit visibility (PR comment + committed summary).

## Acceptance Criteria

1. **AC-1**: `.github/workflows/content-audit.yml` triggers on `workflow_dispatch` (verifiable via GH Actions UI) and on PRs touching `app/content/posts/**` or `app/db/schema.ts`.
2. **AC-2**: A PR touching only `app/routes/login.tsx` (no content path) does NOT trigger the content-audit workflow.
3. **AC-3**: A PR adding a fixture post produces a PR comment with severity counts and an artifact link.
4. **AC-4**: A subsequent push to the same PR with zero blocker changes does NOT create a new comment (delta suppression working).
5. **AC-5**: A subsequent push that introduces a blocker creates an updated comment (same comment, body replaced) reflecting the new counts.
6. **AC-6**: The artifact `content-audit-report-<run-id>` is downloadable from the GHA UI and contains the markdown report.
7. **AC-7**: The workflow does NOT appear in the merge-blocking checks list on the PR.

## Deliverables

- New file `.github/workflows/content-audit.yml`.
- New file `app/tests/content-audit-workflow.test.ts` (Vitest yaml parse + invariant checks).
- Unit tests with 80%+ coverage **(REQUIRED)** — workflow-only task; satisfied vacuously plus structural tests.
- Integration tests for PR comment behavior **(REQUIRED)** — verified on a real PR during Phase 3.

## Tests

- Unit tests:
  - [ ] YAML parse of the workflow file: triggers include `workflow_dispatch` + `pull_request`.
  - [ ] YAML parse: `pull_request.paths` includes both `app/content/posts/**` and `app/db/schema.ts`.
  - [ ] YAML parse: `peter-evans/create-or-update-comment@v4` step is present with `body-includes: <!-- audit-fingerprint`.
  - [ ] YAML parse: artifact upload step uses `actions/upload-artifact@v4` and references `docs/_reports/content-audit-*.md`.
- Integration tests:
  - [ ] On a real fixture PR touching `app/content/posts/en/test-fixture.mdx`, the workflow fires and a comment appears within 2 minutes.
  - [ ] Force-push to the same PR with no new findings does NOT generate a new comment (delta suppression).
  - [ ] Force-push that introduces a `<a href="/broken">` link generates an updated comment with `blocker` count increased.
- Test coverage target: >=80% (vacuously satisfied; workflow-only).
- All tests must pass.

## Success Criteria

- All tests passing.
- Workflow fires only on path-matched PRs.
- Delta suppression works as documented; PR threads stay clean.
- Artifact retention follows the GHA default (90 days; acceptable).
