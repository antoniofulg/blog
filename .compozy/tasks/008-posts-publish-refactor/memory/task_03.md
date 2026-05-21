# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/lib/mdx/pages.server.ts` — sole entry point for static-page load, twin-check, enumeration per ADR-001.

## Important Decisions

- Path-traversal guard uses regex `/\.\.|[/\\]/` + `hasNullByte()` helper (charCodeAt loop). Avoid embedding literal null byte `\x00` in source — tools like grep treat the file as binary. Use `hasNullByte()` which checks `charCodeAt(i) === 0` in a loop.
- `enumerateStaticPages` silently skips files with missing `title` (no throw) — consistent with site-model's error-skip pattern.
- `loadStaticPage` throws on missing `title` (unlike enumeration) — caller gets clear error, not silent null, since a page load with bad frontmatter is actionable.
- Integration test uses `vi.spyOn(process, 'cwd')` to redirect to tmpdir — avoids writing to live worktree during tests.
- `vi.mock("node:fs/promises", async (importOriginal) => { ...actual, readFile: mock, readdir: mock })` required to preserve `mkdir`/`mkdtemp`/`rm`/`writeFile` for integration test setup.
- `vi.mock("node:fs", ...)` only mocks `existsSync` — full module replacement (no `importOriginal`) is fine since only `existsSync` is used.

## Learnings

- `vi.hoisted` is not available in Bun's built-in test runner (`bun test`). Use `bun run test` (vitest) instead.
- Embedding literal `\x00` in a TypeScript source file makes grep/biome treat the file as binary. Always use `charCodeAt(i) === 0` or `String.fromCharCode(0)` at runtime.
- Biome's `noControlCharactersInRegex` rule fires on `\x00` in regex literals. Split the null-byte check out of the regex.
- `biome check --write` applies only safe fixes; `--write --unsafe` needed for `noNonNullAssertion`. Prefer optional chaining `?.` in tests to avoid warnings.

## Files / Surfaces

- Created: `app/lib/mdx/pages.server.ts`
- Created: `app/tests/pages.test.ts`
- No existing files modified.

## Errors / Corrections

- Early regex `/\.\.|[/\\\x00]/` embedded literal null byte when Edit tool substituted `\x00` → broke grep/biome. Fixed by extracting `hasNullByte()` helper.
- Test file initially had `vi.hoisted` from wrong runner; tests ran under vitest after switching to `bun run test`.
- Integration test `mkdtemp` was undefined because `vi.mock("node:fs/promises")` replaced the entire module. Fixed with `importOriginal` spread.

## Ready for Next Run

task_03 complete. `pages.server.ts` ready to be consumed by:
- task_04 (delete `about.server.ts`, move `about.mdx` → `app/content/pages/`)
- task_05 (unified `$slug` loader calls `loadStaticPage`)
- task_06 (content-audit `slug-collision` uses `enumerateStaticPages`)
- task_09 (twin-availability uses `staticPageHasTwin`)
- task_11 (sitemap uses `enumerateStaticPages`)
