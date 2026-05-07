---
provider: manual
pr:
round: 2
round_created_at: 2026-05-07T18:34:07Z
status: resolved
file: app/db/indexer.ts
line: 150
severity: high
author: claude-code
provider_ref:
---

# Issue 002: syncAll upserts before deleting stale rows, breaks on moved files

## Review Comment

`syncAll` calls `upsertPost` for every current file first, then queries and removes stale DB rows. When a file moves (e.g., `content/lorem-ipsum.mdx` → `content/en/lorem-ipsum.mdx`), the stale row `{filePath: 'content/lorem-ipsum.mdx', slug: 'lorem-ipsum', lang: 'en'}` still exists during the upsert phase. The new insert `{filePath: 'content/en/lorem-ipsum.mdx', slug: 'lorem-ipsum', lang: 'en'}` finds no `filePath` conflict (different paths), so the `onConflictDoUpdate(target: filePath)` clause does not fire. PostgreSQL then enforces the `UNIQUE(slug, lang)` constraint and throws a `23505` violation error. `upsertPost` catches, logs, and re-throws; `syncAll` has no error handling in the loop, so the entire sync aborts for that file and all subsequent files.

This affects every deployment against a VPS that has pre-migration data: the 3 posts that moved from `content/*.mdx` to `content/en/*.mdx` hit this exactly.

Fix: swap the order in `syncAll` — delete stale rows first, then upsert:

```typescript
export async function syncAll(contentDir: string): Promise<void> {
  const files = await findMdxFiles(contentDir);
  const fileSet = new Set(files);

  // Delete stale rows before upserting to avoid UNIQUE(slug, lang) conflict
  const rows = await db
    .select({ filePath: posts.filePath })
    .from(posts)
    .where(like(posts.filePath, `${contentDir}/%`));
  for (const row of rows) {
    if (!fileSet.has(row.filePath)) {
      await removePost(row.filePath);
    }
  }

  // Upsert current files (no stale rows remain to cause conflicts)
  for (const filePath of files) {
    await upsertPost(filePath);
  }
}
```

Also update `app/tests/indexer.test.ts` to add a test case for the file-move scenario: upsert old path, then call `syncAll` with only the new path present, and assert the old row is gone and the new row exists with the correct slug/lang.

## Triage

- Decision: `valid`
- Notes: Confirmed root cause. `syncAll` upserted all current files first, then queried and deleted stale rows. For a file-move scenario (`content/old.mdx` → `content/en/old.mdx`), the new insert targets a different `filePath` so `onConflictDoUpdate(target: filePath)` does not fire. PostgreSQL then sees two rows with the same `(slug, lang)` and throws a `23505 UNIQUE` violation before the stale row is ever deleted. Fix: swap order — query DB for stale rows first, delete them, then upsert current files. Updated `indexer.test.ts` with a "file-move" test that asserts delete occurs before insert by comparing `invocationCallOrder`.
