# Git Workflow Rules

## Branch naming

Every branch must match one of these patterns — enforced by GitHub Ruleset at push time:

```
TASK-XXXX/short-description   # normal work, XXXX is zero-padded task number
hotfix/short-description      # production emergency, no task number required
post/<lang>/<slug>            # new content post (advisory; not enforced by Ruleset)
main                          # always exempt
```

Examples:
- `TASK-0003/cicd-vps-pipeline` ✓
- `TASK-0042/fix-login` ✓
- `hotfix/broken-auth` ✓
- `post/en/react-suspense-typescript` ✓ (content branch)
- `post/pt-br/react-suspense-typescript` ✓ (translation branch)
- `feature/my-thing` ✗ — blocked by Ruleset

When creating a branch, look up the compozy task number first. The branch name must be traceable to a task. Content branches (`post/<lang>/<slug>`) are advisory — the GitHub Ruleset does not enforce this pattern.

## Commit messages

All commits must follow Conventional Commits: `type(scope): description`

Allowed types (enforced by commitlint — no others accepted):
- `feat` — new user-facing feature (appears in CHANGELOG)
- `fix` — bug fix (appears in CHANGELOG)
- `chore` — maintenance, dependency updates, tooling
- `docs` — documentation only
- `test` — adding or fixing tests
- `refactor` — code restructuring without behavior change
- `ci` — changes to CI/CD workflows

Scope is optional but encouraged for clarity.

```
feat(blog): add post list pagination
fix(auth): handle expired session cookie
chore: update bun to 1.3.14
docs: update CONTRIBUTING branching section
test(deploy): add DEPLOY_PATH spaces test
refactor(routes): extract post loader into helper
ci: add workflow_run gate to cd.yml
```

Rules:
- Description must be lowercase, imperative mood, no trailing period
- Subject line ≤ 72 characters
- Merge commits are ignored by commitlint (defaultIgnores: true is the default)

The `commit-msg` Lefthook hook validates on every commit locally. CI re-validates on PRs — `--no-verify` bypasses local only, never CI.

## Pre-commit hooks (Lefthook)

Two hooks run automatically after `bun install`:

1. `pre-commit` — Biome auto-fixes and re-stages `*.{js,jsx,ts,tsx,json,css}`
2. `commit-msg` — commitlint blocks non-conforming messages

Run `bunx lefthook install` if hooks are missing after a fresh clone.
