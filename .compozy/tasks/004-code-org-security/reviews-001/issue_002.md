---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T01:24:57Z
status: resolved
file: app/lib/mdx/parser.server.ts
line: 22
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: `parseFrontmatter` missing `title` validation — silent undefined cast

## Review Comment

`parseFrontmatter` in `parser.server.ts` casts `data.title` directly with `as string` without validating that the field exists:

```typescript
return {
  title: data.title as string,  // ← unsafe: undefined cast if title missing
  description: data.description as string | undefined,
  ...
};
```

If an MDX file has a missing or non-string `title` field, `parseFrontmatter` silently returns `{ title: undefined, ... }` typed as `PostFrontmatter` (which declares `title: string`). Downstream consumers treat `title` as a guaranteed string and may crash or display `undefined`.

By contrast, `indexer.ts`'s private `parseFrontmatterBlock` (which performs equivalent parsing for the DB pipeline) has an explicit guard:
```typescript
if (!data.title)
  throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
```

The two parsers now diverge on validation behavior. `parseFrontmatter` currently has no production callers (tests use it; production data goes through `indexer.ts`), so there is no current crash. But when `parseFrontmatter` is called in a production path in V2, it will silently produce invalid `PostFrontmatter` for any file with a missing title.

**Fix:** Add the same guard before the return statement:

```typescript
if (!data.title) {
  throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
}
return {
  title: data.title as string,
  ...
};
```

## Triage

- Decision: `valid`
- Notes: `data.title as string` with no existence check silently casts `undefined` to `string`, violating the `PostFrontmatter` contract (`title: string`). `indexer.ts` already throws on missing title. Fix: add the same guard before the return statement in `parseFrontmatter`.
