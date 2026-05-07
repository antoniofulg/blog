# Task Memory: task_10.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create CONTENT.md, update git-workflow.md, add frontmatter lint test, update AGENTS.md. All CI guardrails for content authoring conventions.

## Important Decisions

- Used `gray-matter` directly in the lint test (not `parseFrontmatter`) to access raw YAML including `category`, `series`, `seriesPart` which `PostFrontmatter` type does not expose.
- `lintFrontmatter` helper function defined in test file (not exported) — lint logic needed only in tests, no separate module.
- `findMdxFiles` helper uses `readdirSync` with `withFileTypes: true` for recursive scan — no glob package needed.
- `CONTENT_DIR = join(import.meta.dirname, "../../content")` — test file is at `app/tests/`, content at repo root `content/`.
- `no-slug.mdx` fixture already had a title — fixture was correct, no fix needed.

## Learnings

- Biome import ordering requires `gray-matter` before `react` (alphabetical). `bunx biome check --write` auto-fixed.
- `gray-matter` parses `publishedAt` as JS Date object; `parseFrontmatter` handles this but `lintFrontmatter` just checks truthiness (string or Date both truthy) — sufficient for required-field check.

## Files / Surfaces

- `CONTENT.md` — created at repo root
- `.agents/rules/git-workflow.md` — added `post/<lang>/<slug>` pattern
- `AGENTS.md` — added "Content authoring: CONTENT.md" to Rules section
- `app/tests/mdx.test.ts` — added lint describe block with 8 test cases
- `app/tests/fixtures/bad-category.mdx` — created (invalid category)
- `app/tests/fixtures/series-no-part.mdx` — created (series without seriesPart)
- `app/tests/fixtures/part-no-series.mdx` — created (seriesPart without series)

## Errors / Corrections

- First `make test` run failed: Biome complained about import ordering (`matter` after `react`) and code formatting. Fixed by running `bunx biome check --write app/tests/mdx.test.ts`.

## Ready for Next Run

task_10 COMPLETE. make test exits 0 (233 passed, 18 skipped). All deliverables verified.
