# Task Memory: task_14.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Update CONTENT.md to reflect the PRD-008 refactor: file-presence publish, static pages convention, language switcher UX, read-only admin.

## Important Decisions

- ADR links in CONTENT.md use relative paths from repo root: `.compozy/tasks/008-posts-publish-refactor/adrs/adr-NNN.md`
- Removed `draft: boolean` optional field from frontmatter table — file presence is the only signal
- Updated folder structure from old `content/en/` to correct `app/content/posts/<locale>/` paths
- New sections added: Publish Workflow, Static Pages (with Slug Collision Policy subsection), Language Switcher, Admin Surface

## Learnings

- Vitest `import.meta.dirname` works for path resolution in tests; test closes cleanly despite the "Vite server" timeout warning (pre-existing, not a regression)
- `close timed out after 10000ms` is pre-existing — all 5 doc-link tests pass in 2ms

## Files / Surfaces

- `CONTENT.md` — fully rewritten with new sections
- `app/tests/content-doc-links.test.ts` — new test file, 5 tests, all pass

## Errors / Corrections

- (none)

## Ready for Next Run

Task complete. Both deliverables done (CONTENT.md updated, doc-link test added). All ACs satisfied.
