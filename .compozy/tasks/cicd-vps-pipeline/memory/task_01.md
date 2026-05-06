# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Install commitlint, create config, add lefthook commit-msg hook. COMPLETE.

## Important Decisions

- Pinned versions: `@commitlint/cli@19.8.1` and `@commitlint/config-conventional@19.8.1` (from techspec)
- ES module export syntax required (package.json has `"type": "module"`)
- `lefthook.yml` commit-msg hook uses `./node_modules/.bin/commitlint --edit {1}`

## Learnings

- `public-routes.test.ts` fails pre-existing on main (requires live DB, not regressions from this task)
- `unknown-type: bad type` fails parser (dash in type), use `build: ...` to test disallowed types

## Files / Surfaces

- `package.json` — devDependencies (+2 commitlint packages)
- `commitlint.config.js` — new file at root
- `lefthook.yml` — commit-msg section added
- `bun.lock` — updated by `bun install`
- `.git/hooks/commit-msg` — registered by `bunx lefthook install`

## Errors / Corrections

## Ready for Next Run

Task complete. diff ready for manual review. bun.lock must be committed alongside package.json.
