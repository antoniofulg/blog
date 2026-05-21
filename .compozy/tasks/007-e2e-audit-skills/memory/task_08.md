# Task Memory: task_08.md

Keep only task-local execution context here.

## Objective Snapshot

Ship e2e-coverage SKILL + slash alias + testing.md + AGENTS updates. Status: completed.

## Important Decisions

- Parsed YAML frontmatter manually in tests (no `js-yaml` dep — avoids `@types/js-yaml` requirement and keeps tsc clean).
- `.claude/commands/` directory did not exist; created it as part of this task.
- No `_tasks.md` master file exists — individual task files are the tracking artifacts.

## Files / Surfaces

New files:
- `.agents/skills/e2e-coverage/SKILL.md`
- `.claude/skills/e2e-coverage` (symlink → `../../.agents/skills/e2e-coverage`)
- `.claude/commands/e2e-coverage.md`
- `.agents/rules/testing.md`
- `app/tests/e2e-skill.test.ts` (13 tests, all passing)

Modified files:
- `.agents/rules/auth.md` — appended E2E anti-patterns section
- `AGENTS.md` — added `tests/e2e/`, e2e-coverage skill row, testing rules pointer

## Learnings

- Biome's `noNonNullAssertion` fires on `match![1]` — use `match?.[1]` instead.
- Biome import sort: `js-yaml` (external) must come before `vitest` (external) per Biome's alphabetical sort within the same import group.
- `js-yaml` is available transitively but has no bundled types — avoid it in test files; parse frontmatter inline.

## Ready for Next Run

task_09 (admin-write.spec.ts) — must follow `.agents/rules/testing.md` conventions documented here.
