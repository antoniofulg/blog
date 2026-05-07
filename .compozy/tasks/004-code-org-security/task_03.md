---
status: completed
title: MDX Library Split
type: refactor
complexity: medium
dependencies:
    - task_01
---

# Task 03: MDX Library Split

## Overview

Split `app/lib/mdx.server.ts` into two single-responsibility files inside `app/lib/mdx/`: `parser.server.ts` for frontmatter extraction and `renderer.server.ts` for MDX compilation. Delete `mdx.server.ts` after both files are in place. Update the two callers that import from the old location. No barrel file is created (ADR-005).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/lib/mdx/parser.server.ts` exporting `parseFrontmatter(filePath: string): Promise<PostFrontmatter>` importing `PostFrontmatter` from `#/types/content` (established in task_01)
- MUST create `app/lib/mdx/renderer.server.ts` exporting `renderMdx(source: string): Promise<ComponentType>`
- MUST move function bodies verbatim from `mdx.server.ts` — no logic changes
- MUST delete `app/lib/mdx.server.ts` after both new files are complete
- MUST NOT create an `index.ts` barrel in `app/lib/mdx/` (ADR-005 — tree-shaking risk)
- MUST update `app/routes/$slug.tsx` to import `renderMdx` from `#/lib/mdx/renderer.server`
- MUST NOT update `app/routes/admin/preview.$slug.tsx` in this task — task_04 handles its server fn (which includes the renderer import)
- MUST run `tsc --noEmit` immediately after deleting `mdx.server.ts` to catch any missed import sites
- MUST pass `tsc --noEmit` with zero errors
</requirements>

## Subtasks

- [x] 3.1 Create `app/lib/mdx/parser.server.ts` — move `parseFrontmatter` verbatim, update `PostFrontmatter` import to `#/types/content`
- [x] 3.2 Create `app/lib/mdx/renderer.server.ts` — move `renderMdx` verbatim, no type import changes needed
- [x] 3.3 Delete `app/lib/mdx.server.ts`
- [x] 3.4 Update `app/routes/$slug.tsx` — change `renderMdx` import from `#/lib/mdx.server` to `#/lib/mdx/renderer.server`
- [x] 3.5 Run `tsc --noEmit` — fix any remaining missed import sites before marking complete

## Implementation Details

See TechSpec "Core Interfaces" for `parser.server.ts` and `renderer.server.ts` signatures, and "File-by-File Changes" for the deletion and caller update list.

`mdx.server.ts` currently exports: `PostFrontmatter` interface (removed — type now in `#/types/content` from task_01), `parseFrontmatter`, `renderMdx`.

Known callers of the old `mdx.server.ts` exports:
- `$slug.tsx` — imports `renderMdx` (update to `#/lib/mdx/renderer.server` in this task)
- `admin/preview.$slug.tsx` — imports `renderMdx` indirectly through its server fn (handled in task_04)

### Relevant Files

- `app/lib/mdx.server.ts` — source file to be split and deleted; contains `parseFrontmatter` (lines ~44-67) and `renderMdx` (lines ~69-83)
- `app/routes/$slug.tsx` — imports `renderMdx` from `#/lib/mdx.server`; must update import path
- `app/types/content.ts` — created in task_01; `parser.server.ts` imports `PostFrontmatter` from here

### Dependent Files

- `app/routes/admin/preview.$slug.server.ts` — created in task_04; will import `renderMdx` from `#/lib/mdx/renderer.server`
- `app/tests/mdx.test.ts` — tests `parseFrontmatter` and `renderMdx`; import paths in test must update if they reference `mdx.server.ts` directly
- `app/tests/mdx-integ.test.ts` — integration tests for MDX pipeline; same import path concern

### Related ADRs

- [ADR-005: MDX directory uses direct imports, no barrel file](adrs/adr-005.md) — prohibits `index.ts`; Shiki/MDX compiler must stay server-only to avoid client bundle pollution

## Deliverables

- `app/lib/mdx/parser.server.ts` exporting `parseFrontmatter`
- `app/lib/mdx/renderer.server.ts` exporting `renderMdx`
- `app/lib/mdx.server.ts` deleted
- `app/routes/$slug.tsx` updated with new `renderMdx` import path
- `tsc --noEmit` exits 0 after all changes
- Existing MDX test suite passes unmodified (REQUIRED)

## Tests

- Unit tests:
  - [ ] `tsc --noEmit` passes after `mdx.server.ts` deletion — confirms all import sites updated
  - [ ] `app/tests/mdx.test.ts` passes — `parseFrontmatter` and `renderMdx` must behave identically after move (verbatim body move, no logic change)
  - [ ] `make lint` passes — no import direction violations introduced by new directory
- Integration tests:
  - [ ] `app/tests/mdx-integ.test.ts` passes — end-to-end MDX compilation pipeline must be unaffected by file split
  - [ ] `app/tests/public-routes.test.ts` passes — `$slug.tsx` route uses `renderMdx`; must compile and render correctly after import update
- Test coverage target: existing suite coverage maintained; no logic changes means no new coverage gaps
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `app/lib/mdx.server.ts` does not exist
- `app/lib/mdx/parser.server.ts` and `app/lib/mdx/renderer.server.ts` exist
- No `app/lib/mdx/index.ts` barrel exists
- No remaining imports of `#/lib/mdx.server` anywhere in `app/` (grep confirms zero hits)
