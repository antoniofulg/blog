# Git Workflow Rules

## Branch naming

Every branch must match one of these patterns — enforced by the `branch-check` CI job and the GitHub Ruleset at push time:

```
feat/short-description        # new user-facing feature
fix/short-description         # bug fix
chore/short-description       # maintenance, deps, tooling
docs/short-description        # documentation only
test/short-description        # adding or fixing tests
refactor/short-description    # restructure without behavior change
ci/short-description          # CI/CD workflow changes
hotfix/short-description      # production emergency
post/<lang>/<slug>            # new content post or translation
main                          # always exempt
```

The prefix list mirrors the Conventional Commits types enforced by commitlint, so the branch type matches the commit type.

Examples:
- `feat/post-list-pagination` ✓
- `fix/expired-session-cookie` ✓
- `chore/bun-1-3-14` ✓
- `docs/contributing-branching` ✓
- `test/deploy-path-spaces` ✓
- `refactor/post-loader-helper` ✓
- `ci/workflow-run-gate` ✓
- `hotfix/broken-auth` ✓
- `post/en/react-suspense-typescript` ✓ (content branch)
- `post/pt-br/react-suspense-typescript` ✓ (translation branch)
- `feature/my-thing` ✗ — `feature/` is not in the prefix list, use `feat/`
- `TASK-0042/fix-login` ✗ — TASK-XXXX prefix is deprecated (was an early Compozy convention; see ADR/Changelog)

Slug must match `[a-z0-9][a-z0-9-]*`. For `post/<lang>/<slug>`, `<lang>` must be `en`, `pt-br`, or any lowercase-with-hyphens locale string.

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
