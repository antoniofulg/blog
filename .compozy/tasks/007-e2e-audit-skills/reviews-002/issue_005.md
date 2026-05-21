---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: tests/e2e/global-setup.ts
line: 56
severity: low
author: claude-code
provider_ref:
---

# Issue 005: global-setup dynamically imports writeFile despite static import

## Review Comment

`tests/e2e/global-setup.ts:1` statically imports `{ readFile, writeFile }` from `node:fs/promises`. At L56-57, the same `writeFile` is re-imported dynamically:

```ts
const fixtureFilePath = join(tmpdir(), "e2e-fixture-post.mdx");
const { writeFile: wf } = await import("node:fs/promises");
await wf(fixtureFilePath, "This is a fixture post for E2E tests.\n", "utf-8");
```

The dynamic import is dead code — `writeFile` is already in scope as an alias of the static binding. Reading the file, it looks like the dynamic import was carried over from a prior iteration where `writeFile` was not yet hoisted to the static imports, and the cleanup was missed.

The bug is benign at runtime (Node caches `node:fs/promises` so the second resolution costs nothing observable), but it introduces a stylistic inconsistency that future readers may interpret as intentional (e.g. "this writeFile call needs to be lazy for some reason"). It also adds an `await` to a critical-path setup step that does not need one.

**Suggested fix:** delete L56 entirely and change L57 to `await writeFile(fixtureFilePath, "This is a fixture post for E2E tests.\n", "utf-8");`. Remove any unused `wf` reference. The static `writeFile` import on L1 already covers the call.

## Triage

- Decision: `valid`
- Root cause: `global-setup.ts:56` dynamically imports `writeFile` as `wf` despite `writeFile` being statically imported on line 1. The dynamic import is dead code left from an earlier iteration; it adds a spurious `await` and misleads readers into thinking lazy loading is intentional.
- Fix applied: Deleted the `const { writeFile: wf } = await import(...)` line and replaced `wf(...)` with `writeFile(...)` using the existing static binding.
