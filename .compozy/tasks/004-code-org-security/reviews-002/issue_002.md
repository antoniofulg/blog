---
provider: manual
pr:
round: 2
round_created_at: 2026-05-07T01:38:07Z
status: resolved
file: app/tests/mdx-integ.test.ts
line: 32
severity: low
author: claude-code
provider_ref:
---

# Issue 002: Vite stub coverage test omits `#/lib/session` after it was added

## Review Comment

`mdx-integ.test.ts` contains a structural test that verifies server-only modules are listed in `vite.config.ts`'s `SERVER_ONLY_IDS` stub:

```typescript
it("mdx modules are protected from client bundle in vite.config.ts", () => {
  const viteConfig = readFileSync(..., "utf-8");
  expect(viteConfig).toContain("#/lib/mdx/renderer.server");
  expect(viteConfig).toContain("#/lib/mdx/parser.server");
  expect(viteConfig).toContain("serverOnlyStubPlugin");
});
```

Round 001 issue_001 added `#/lib/session` to `SERVER_ONLY_IDS`. The test was not updated to include this new entry. If someone removes `#/lib/session` from the stub list in a future change, no test will detect the omission — the test only guards the MDX module IDs.

**Fix:** Add the session stub assertion to the existing test:

```typescript
expect(viteConfig).toContain("#/lib/session");
```

## Triage

- Decision: `valid`
- Notes: `vite.config.ts` line 20 already has `"#/lib/session"` in `SERVER_ONLY_IDS`, but the structural test in `mdx-integ.test.ts` only asserted the MDX module IDs. Added `expect(viteConfig).toContain("#/lib/session")` to that test. Verified: 10/10 tests pass, lint clean.
