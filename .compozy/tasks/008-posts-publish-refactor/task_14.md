---
status: completed
title: Update CONTENT.md (file-presence semantics + pages convention)
type: docs
complexity: low
dependencies: []
feature: docs/content-authoring
---

# Task 14: Update CONTENT.md (file-presence semantics + pages convention)

## Overview
Update the project's content-authoring documentation to reflect the refactor: file presence is the only publish signal, static pages live under `app/content/pages/<locale>/<slug>.mdx`, missing-twin UX is the per-menu-item hint + confirm modal, and the admin surface is read-only. Documenting this is the only way the author internalizes the new workflow on the next post.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `CONTENT.md` to document file-presence-as-publish (no `published`/`draft` frontmatter field exists or is honored).
- MUST document the `app/content/pages/<locale>/<slug>.mdx` directory convention and the consequence "adding a new page = drop the file, no route file".
- MUST document the post slug vs page slug collision policy (posts win at runtime; collision flagged by content-audit).
- MUST document the missing-twin language-switcher UX (per-menu-item hint + confirm modal redirecting to home on accept).
- MUST document the admin surface as read-only (list + locale filter + view-in-new-tab; no toggle/edit/new/preview).
- MUST cross-reference relevant ADRs (001, 003, 005) by ADR number and one-line summary.
- MUST NOT introduce a separate docs file when an existing section in `CONTENT.md` fits.
</requirements>

## Subtasks
- [x] 14.1 Read the current `CONTENT.md` to find the right insertion points (publish workflow, pages, switcher, admin sections — create if absent).
- [x] 14.2 Add or rewrite the publish-workflow section with file-presence semantics.
- [x] 14.3 Add or rewrite the static-pages section with the new directory convention + collision policy.
- [x] 14.4 Add or rewrite the language-switcher section with the hint + modal flow.
- [x] 14.5 Add or rewrite the admin section reflecting the read-only V1 scope.
- [x] 14.6 Cross-reference ADR-001 / ADR-003 / ADR-005 / ADR-007 inline (link or footnote).

## Implementation Details
See PRD "User Stories → P1 Author" and "User Experience → Author journey" for the workflow narrative this doc must teach. The collision policy is in ADR-005; the switcher UX in ADR-003; the pages convention in ADR-001.

### Relevant Files
- `CONTENT.md` — single target.

### Dependent Files
- None directly; this is documentation.

### Related ADRs
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — pages convention.
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — switcher behavior.
- [ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision](adrs/adr-005.md) — collision policy.
- [ADR-007: Sitemap.xml generated per-request, no cache](adrs/adr-007.md) — only mentioned if relevant to author workflow.

## Acceptance Criteria
1. AC-1: `CONTENT.md` includes a section explaining that file presence under `app/content/posts/<locale>/` makes a post live, and `git rm` unpublishes it.
2. AC-2: `CONTENT.md` includes a section documenting the `app/content/pages/<locale>/<slug>.mdx` convention with an example (e.g., `/uses`).
3. AC-3: `CONTENT.md` documents the post-wins-on-collision rule and points the reader at the content-audit warning that surfaces collisions.
4. AC-4: `CONTENT.md` documents the per-menu-item availability hint + confirm modal as the missing-twin flow.
5. AC-5: `CONTENT.md` documents the V1 admin surface as read-only (list + locale filter + view-in-new-tab).

## Deliverables
- Updated `CONTENT.md`.
- Unit tests with 80%+ coverage **(REQUIRED)** — doc-only task; coverage met by the lint-tests CI step that scans docs links for validity (if applicable) or by inspection in the PR review.
- Integration tests for documented workflow **(REQUIRED)** — covered indirectly by the e2e + unit tests landed in tasks 01–13, which validate the behavior this doc teaches.

## Tests
- Unit tests:
  - [x] Doc-link validity: every ADR link in `CONTENT.md` resolves to an existing file under `.compozy/tasks/008-posts-publish-refactor/adrs/` (assertable via a small Vitest test that reads the file and checks each link target).
  - [ ] (Optional) A markdownlint or similar pass over `CONTENT.md` reports no errors.
- Integration tests:
  - [ ] N/A — behavior validation lives in tasks 01–13.
- Test coverage target: >=80% (interpreted as "ADR cross-references are 100% live" for this doc-only task)
- All tests must pass

## Success Criteria
- All tests passing
- ADR cross-references resolve
- Author can read the updated `CONTENT.md` and produce a new post + translation + static page without consulting any other file
- The five Acceptance Criteria above are visibly satisfied in the diff
