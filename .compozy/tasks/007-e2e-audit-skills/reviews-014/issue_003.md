---
provider: manual
pr:
round: 14
round_created_at: 2026-05-20T22:56:13Z
status: resolved
file: .github/workflows/ci.yml
line: 20
severity: high
author: claude-code
provider_ref:
---

# Issue 003: CI bun 1.3.13 lacks `node:fs/promises.glob` — link-parser tests fail on PR while local passes

## Review Comment

PR #18 `quality (test)` job (https://github.com/antoniofulg/blog/actions/runs/26194697324/job/77071318538) reports two failures:

```
FAIL  app/tests/link-parser.test.ts > link-parser: integration — whole tree parse > walks app/content/posts/** without throwing and returns arrays
FAIL  app/tests/link-parser.test.ts > link-parser: integration — whole tree parse > whole-tree parse completes in under 2 seconds
TypeError: glob(...) is not a function or its return value is not async iterable
```

Same `make test` invocation passes locally. The delta:

| Environment | Bun version | `import { glob } from "node:fs/promises"` |
|---|---|---|
| Local (operator) | **1.3.14** | available ✓ |
| CI (`.github/workflows/ci.yml:20` + `:86`) | **1.3.13** | undefined ✗ |

Bun added `fs.promises.glob` in 1.3.14. CI is pinned to 1.3.13 via `oven-sh/setup-bun@v2 with bun-version: "1.3.13"`. The local test runs against a newer runtime than CI — a silent capability gap that only surfaces on the gate, never locally.

`app/tests/link-parser.test.ts:1` imports the missing API:

```ts
import { glob } from "node:fs/promises";
```

When `glob` is undefined at runtime, calling `glob(pattern)` throws `TypeError: glob(...) is not a function` and the spec aborts.

## Why this matters

- **PR gate blocked.** `quality (test)` matrix entry fails on every commit until either the runtime version aligns or the code drops the dependency. The branch cannot ship to main with this red.
- **Trust gap.** Operators relying on "passes locally → safe to push" are bitten by a version skew they didn't introduce. The `oven-sh/setup-bun@v2 bun-version` value is a single string in the workflow — there's no warning when local drifts ahead of it.
- **Bleeding-edge API risk.** Even if CI is bumped to 1.3.14, future Bun releases may move the API or rename it. Production code generally shouldn't sit on the newest-version frontier of a runtime API.

## Suggested fix paths

### Path A — bump CI Bun to 1.3.14 (recommended immediate)

Edit `.github/workflows/ci.yml`:

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: "1.3.14"   # was 1.3.13
```

Two locations: line 20 (`quality` matrix job) and line 86 (`commitlint` job). Both should match.

Cheapest unblock. Risk: CI passes only as long as the operator's local bun matches. If a future operator runs 1.3.15+ and that release breaks the same API, CI silently lags again.

### Path B — replace `node:fs/promises.glob` with a portable alternative

The codebase already has a portable recursive-readdir helper at `app/lib/site-model.server.ts:findMdxFiles`. Reuse it (or extract to `app/lib/fs-walk.ts`) so the test doesn't depend on a runtime-version-specific API:

```ts
async function walkMdx(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walkMdx(full));
        else if (entry.name.endsWith(".mdx")) out.push(full);
    }
    return out;
}
```

Or use the `glob` npm package (`bun add -d glob`) — bun-agnostic, well-supported. Pattern:

```ts
import { glob } from "glob";
const files = await glob("**/*.mdx", { cwd: contentDir });
```

### Path C — both A and B

Align CI to current local Bun (Path A) AND drop the runtime-version-specific import (Path B). Cheapest CI unblock + durable test code.

## Recommendation

Path C. Apply Path A now to unblock the PR; Path B as a follow-up commit so the test no longer assumes a specific Bun version. Capture both in a single fix commit to keep the history clean.

## Acceptance criteria

1. `quality (test)` matrix entry passes on the next PR push.
2. `bun-version` in `.github/workflows/ci.yml` matches the value documented in `package.json` engines (or a project README that specifies the supported Bun range).
3. `app/tests/link-parser.test.ts` imports a file-walk utility that does NOT depend on `node:fs/promises.glob`.
4. `grep -rn 'node:fs/promises.*glob' app/ scripts/ tests/` returns zero matches after Path B.
5. Optional: add a CI step that runs `bun --version` and echoes the resolved value, so future skews are visible in the run log.

## Triage

- Decision: `valid`
- Notes: Confirmed `bun-version: "1.3.13"` at `.github/workflows/ci.yml:20` and `:86`. Local bun is 1.3.14. `node:fs/promises.glob` was added in bun 1.3.14, so the two integration tests in `app/tests/link-parser.test.ts` that use `for await (const f of glob(...))` throw `TypeError: glob(...) is not a function or its return value is not async iterable` on CI. Fix: Path C — bump both ci.yml locations to "1.3.14" AND replace `node:fs/promises.glob` with inline recursive readdir (matching the `findMdxFiles` pattern already in `site-model.server.ts`) to avoid future version-pinning sensitivity.
