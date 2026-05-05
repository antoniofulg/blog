---
provider: manual
pr:
round: 4
round_created_at: 2026-05-05T17:27:46Z
status: resolved
file: CONTRIBUTING.md
line: 42
severity: low
author: claude-code
provider_ref:
---

# Issue 002: CONTRIBUTING.md pre-commit section omits make check (TypeScript gate)

## Review Comment

The pre-commit recommendation in CONTRIBUTING.md is:

```sh
make test && make lint
```

`make check` (`bunx tsc --noEmit`) — TypeScript type checking — is a PRD F7 quality gate alongside `test`, `lint`, and `format`. It is not mentioned. A contributor following the guide would not run type checks before committing. TypeScript errors would only surface in CI (Phase 2) after the PR is opened, increasing review friction and possibly blocking merges.

The omission is inconsistent with the Makefile itself, which documents all four gates as peer targets under the `# Quality Gates` section.

**Fix**: Add `make check` to the pre-commit section:

```markdown
## Before you commit

```sh
make test && make lint && make check
```
```

Optionally expand to explain what each does:

```markdown
## Before you commit

| Command | What it checks |
|---------|----------------|
| `make test` | Vitest test suite |
| `make lint` | Biome linter |
| `make check` | TypeScript type errors (`tsc --noEmit`) |
```

## Triage

- Decision: `valid`
- Notes: Pre-commit section at line 44 only listed `make test && make lint`, omitting `make check` (TypeScript gate). `make check` is confirmed in Makefile line 71 under `# Quality Gates`. Omission means contributors skip type checks before committing, TypeScript errors surface only in CI. Fixed by appending `&& make check` to the pre-commit command.
