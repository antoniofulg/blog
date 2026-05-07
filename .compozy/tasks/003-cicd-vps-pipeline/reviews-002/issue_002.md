---
provider: manual
pr:
round: 2
round_created_at: 2026-05-06T17:31:48Z
status: resolved
file: .github/workflows/cd.yml
line: 56
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: conventional-changelog-cli not in package.json; unpinned at runtime

## Review Comment

The `changelog` job uses `bunx conventional-changelog-cli` but the package is absent from `devDependencies` in `package.json`. `bun install --frozen-lockfile` (line 55) installs only what is in `bun.lock`; it does not install `conventional-changelog-cli`. When the `bunx` command runs, bun fetches the **latest available version** from the registry at that moment.

This creates two problems:

1. **Unpinned version**: A breaking release of `conventional-changelog-cli` silently changes changelog output or fails the step on the next deploy. The project pins all other package versions explicitly (no `^` or `~` in `package.json`); this is inconsistent.

2. **Network dependency at deploy time**: The changelog step fails if the npm registry is unreachable during the CD run. The install step already succeeded with the frozen lockfile; the subsequent `bunx` download is an avoidable second network call.

**Fix**: Add `conventional-changelog-cli` to `devDependencies` with a pinned version, then run `bun install` to update `bun.lock`:

```json
"devDependencies": {
  "@commitlint/cli": "19.8.1",
  "@commitlint/config-conventional": "19.8.1",
  "conventional-changelog-cli": "5.0.0"
}
```

The `changelog` job already runs `bun install --frozen-lockfile` before invoking `bunx`, so once the package is in `bun.lock`, `bunx conventional-changelog-cli` resolves to the installed binary without a network fetch.

## Triage

- Decision: `valid`
- Notes: `conventional-changelog-cli` absent from devDependencies; `bunx` fetched latest at deploy time, bypassing frozen lockfile. Added `"conventional-changelog-cli": "5.0.0"` to devDependencies in package.json and ran `bun install` to update bun.lock. Now `bunx` resolves installed binary, no extra network fetch needed.
