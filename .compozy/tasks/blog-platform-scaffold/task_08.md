---
status: pending
title: MDX Renderer
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 8: MDX Renderer

## Overview

Implement `app/lib/mdx.server.ts` — a server-only module that compiles `.mdx` source strings to React components using `@mdx-js/mdx` (ADR-003) and parses frontmatter from `.mdx` files. Shiki is wired in as a rehype plugin for server-side syntax highlighting. The module is registered with `vite-env-only` to guarantee the compiler never ships to the client bundle.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `parseFrontmatter(filePath: string): Promise<PostFrontmatter>` that reads and parses YAML frontmatter from a `.mdx` file on disk
- MUST implement `renderMdx(source: string): Promise<React.ComponentType>` using `compile()` + `run()` from `@mdx-js/mdx` with `outputFormat: 'function-body'`
- MUST include `remarkGfm` in the remark plugin chain (GitHub Flavored Markdown support)
- MUST include `@shikijs/rehype` in the rehype plugin chain with a configured theme (ADR-003)
- MUST pass `baseUrl: import.meta.url` to `run()` for correct Bun ESM resolution
- MUST register `app/lib/mdx.server.ts` in `vite-env-only` in `app.config.ts`
- MUST NOT export any function that executes in a browser context — this module is 100% server-side
- SHOULD cache compiled MDX output in a module-level Map keyed by file path + mtime to avoid recompiling unchanged files on every request
</requirements>

## Subtasks

- [ ] 8.1 Install `@mdx-js/mdx`, `remark-gfm`, `@shikijs/rehype`, and a YAML frontmatter parser (e.g., `gray-matter`)
- [ ] 8.2 Implement `parseFrontmatter(filePath)` returning `{ title, description, publishedAt, slug }` from the YAML block
- [ ] 8.3 Implement `renderMdx(source)` using `compile()` + `run()` with remark-gfm and Shiki rehype plugin
- [ ] 8.4 Add `app/lib/mdx.server.ts` to `vite-env-only` in `app.config.ts`
- [ ] 8.5 Write a fixture `.mdx` file in `tests/fixtures/` with a heading, paragraph, and fenced code block; use it in all tests

## Implementation Details

See TechSpec "Core Interfaces" for the `PostFrontmatter` interface shape and the `renderMdx` / `parseFrontmatter` function signatures. See ADR-003 "Implementation Notes" for the exact `compile()` + `run()` call pattern. Do not reproduce the code snippet here — reference ADR-003 directly.

### Relevant Files

- `app/lib/mdx.server.ts` — new file; `parseFrontmatter` and `renderMdx` exports
- `app.config.ts` (task_01) — modified; add `mdx.server.ts` to `vite-env-only`
- `tests/fixtures/sample.mdx` — new file; test fixture for unit and integration tests

### Dependent Files

- `app/routes/$slug.tsx` (task_09) — calls `renderMdx` to compile post content
- `app/routes/admin/preview.$slug.tsx` (task_11) — calls `renderMdx` for admin preview
- `app/db/indexer.ts` (task_05) — may reuse `parseFrontmatter` for frontmatter extraction

### Related ADRs

- [ADR-003: MDX Compilation — @mdx-js/mdx Direct](adrs/adr-003.md) — chosen library, `compile()` + `run()` pattern, Shiki rehype integration, `vite-env-only` requirement

## Deliverables

- `app/lib/mdx.server.ts` with `parseFrontmatter` and `renderMdx`
- `tests/fixtures/sample.mdx` test fixture
- Updated `app.config.ts` with `vite-env-only` entry
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for MDX rendering **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `parseFrontmatter` on the fixture file returns `title`, `description`, and `publishedAt` matching the YAML block
  - [ ] `parseFrontmatter` returns `undefined` for optional fields not present in the frontmatter
  - [ ] `parseFrontmatter` derives `slug` from the filename when frontmatter has no `slug` field
  - [ ] `renderMdx` called with a heading and paragraph returns a React component (not null, not a string)
  - [ ] `renderMdx` output contains Shiki-highlighted HTML for a TypeScript fenced code block (assert `class="shiki"` or token markup in rendered HTML)
- Integration tests:
  - [ ] Rendering the fixture `.mdx` to a string produces an `<h1>` tag matching the first heading
  - [ ] Rendering a file with `**bold**` produces `<strong>` in the output (remark-gfm active)
  - [ ] `app/lib/mdx.server.ts` is absent from the client JavaScript bundle (inspect output)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `mdx.server.ts` is not present in any client-side bundle chunk
- Rendered output includes Shiki-highlighted code blocks without a separate CSS file
