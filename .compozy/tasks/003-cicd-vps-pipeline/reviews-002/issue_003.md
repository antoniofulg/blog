---
provider: manual
pr:
round: 2
round_created_at: 2026-05-06T17:31:48Z
status: resolved
file: .github/workflows/ci.yml
line: 18
severity: low
author: claude-code
provider_ref:
---

# Issue 003: oven-sh/setup-bun@v2 used without pinning bun version

## Review Comment

Three workflow steps use `oven-sh/setup-bun@v2` without a `bun-version` input:

- `ci.yml` line 18 (`quality` job)
- `ci.yml` line 29 (`commitlint` job)
- `cd.yml` line 62 (`changelog` job)

Without a pinned version, `setup-bun@v2` installs the latest bun release at the time each workflow run starts. Bun has introduced breaking changes between minor versions (e.g., bundler API changes, test runner output format changes). A bun upgrade could silently change `make test`, `make lint`, or `make check` output, break `bun install --frozen-lockfile` behavior, or alter how `bunx` resolves binaries — all without any code change in the repository.

The project pins all npm package versions without range operators. Using an unpinned bun version is inconsistent with that discipline.

**Fix**: Add `with: bun-version: "1.x.x"` (pin to the tested version) in all three step blocks. Check the current bun version locally with `bun --version`:

```yaml
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.13"   # or whatever version is in local dev
```

## Triage

- Decision: `valid`
- Notes: All three `oven-sh/setup-bun@v2` steps lacked `bun-version`, installing latest bun at runtime — inconsistent with project's pinned-dependency discipline. Pinned to `1.3.13` (local dev version) in ci.yml lines 18+29 and cd.yml line 62.
