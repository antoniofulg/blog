---
provider: manual
pr:
round: 2
round_created_at: 2026-05-07T01:38:07Z
status: resolved
file: app/tests/mdx.test.ts
line: 13
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: No test for `parseFrontmatter` throwing on missing title

## Review Comment

Round 001 issue_002 added a title validation guard to `parseFrontmatter`:

```typescript
if (!data.title) {
  throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
}
```

The `mdx.test.ts` test suite for `parseFrontmatter` covers four cases (title/description/publishedAt present, optional fields absent, slug from filename, slug from frontmatter), but has no test case for the error path — i.e., what happens when a fixture file has no `title` field. If the guard is accidentally removed in a future refactor, no test catches the regression.

**Fix:** Add a test case and a matching fixture:

```typescript
it("throws when frontmatter has no title field", async () => {
  const err = await parseFrontmatter(join(FIXTURES, "no-title.mdx")).catch(
    (e) => e,
  );
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).message).toContain("Missing required frontmatter");
});
```

Create `app/tests/fixtures/no-title.mdx`:
```mdx
---
description: A post with no title.
---

Content here.
```

## Triage

- Decision: `valid`
- Notes: The title validation guard exists in `parseFrontmatter` but had no test covering the error path. Added `app/tests/fixtures/no-title.mdx` (frontmatter with description but no title) and a new test case in `mdx.test.ts` that asserts the thrown `Error` message contains "Missing required frontmatter". Verified: 10/10 tests pass, lint clean.
