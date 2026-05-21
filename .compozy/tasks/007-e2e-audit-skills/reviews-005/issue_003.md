---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: resolved
file: scripts/audit-fe.ts
line: 12
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: parseRoutes CSV split does not trim or filter empty segments

## Review Comment

`scripts/audit-fe.ts:9-13`:

```ts
export function parseRoutes(args: string[]): string[] | undefined {
  const flag = args.find((a) => a.startsWith("--routes="));
  if (!flag) return undefined;
  return flag.slice("--routes=".length).split(",");
}
```

The `.split(",")` produces empty strings and whitespace-padded values for malformed input:

- `--routes=` → `[""]` (single empty string, not undefined)
- `--routes=/login,` → `["/login", ""]` (trailing comma → empty segment)
- `--routes=,/foo,/bar` → `["", "/foo", "/bar"]` (leading comma → empty segment)
- `--routes=/foo, /bar` → `["/foo", " /bar"]` (whitespace-padded; route lookup fails silently)

When the dead `routes` flag is wired up properly (per issue 001's fix), these malformed entries will be passed to whatever filter logic consumes them. Empty strings match no routes (silent no-op finding count); whitespace-padded entries fail string comparison against `RouteEntry.path` values (false-negative — the developer's `/foo` is dropped because they accidentally typed a space).

Even today, while `parseRoutes` is dead code, the brittleness is documented in the test file (`audit-fe-cli.test.ts`) without normalization tests — locking in the buggy behavior.

**Suggested fix:** add normalization:

```ts
return flag
  .slice("--routes=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
```

Add Vitest tests for the four edge cases enumerated above:

- `parseRoutes(["--routes="])` returns `undefined` (or `[]` — design call) instead of `[""]`.
- `parseRoutes(["--routes=/foo,"])` returns `["/foo"]`.
- `parseRoutes(["--routes=,/foo,/bar"])` returns `["/foo", "/bar"]`.
- `parseRoutes(["--routes=/foo, /bar"])` returns `["/foo", "/bar"]`.

Optional but recommended: validate each route matches `/^\/[\w\-/.]*$/` and reject (or warn) on malformed paths.

## Triage

- Decision: `valid`
- Notes: Confirmed. `scripts/audit-fe.ts:12` splits on `,` with no `.trim()` or `.filter(Boolean)`. `--routes=` produces `[""]`, trailing/leading commas produce empty segments, spaces produce whitespace-padded paths. When issue 001's wiring is in place these bad values reach the inventory filter and silently drop routes. Fix: add `.map(s => s.trim()).filter(Boolean)`, return `undefined` when result is empty.
