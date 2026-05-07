---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: resolved
file: app/lib/watcher.server.ts
line: 49
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Watcher catch-all calls removePost on upsertPost failure

## Review Comment

The debounce callback catches errors from both `stat()` and `upsertPost()` in a single try/catch and routes all failures to `removePost`:

```typescript
try {
    await stat(filePath);
    await upsertPost(filePath);
} catch {
    await removePost(filePath);
}
```

`stat` failure (ENOENT) correctly indicates the file was deleted → call `removePost`. But `upsertPost` can throw for reasons unrelated to file existence: malformed frontmatter (missing `title`), a slug uniqueness conflict in the DB, a transient network error to Postgres. In these cases the file still exists on disk, yet `removePost` deletes its record from the index.

Concrete data-loss scenario: author renames a post's title in frontmatter but accidentally introduces a YAML syntax error. The watcher calls `upsertPost`, which throws a parse error. The catch block calls `removePost`, deleting the row — including the post's `isPublished = true` state and accumulated `viewCount`. When the author fixes the typo, the post is re-indexed as a draft with zero views.

The inline comment acknowledges the `upsertPost` throw path but incorrectly assumes it only occurs when the DB is down. That assumption does not hold.

**Fix**: Separate `stat` and `upsertPost` error handling:

```typescript
let fileExists: boolean;
try {
    await stat(filePath);
    fileExists = true;
} catch {
    fileExists = false;
}

if (fileExists) {
    await upsertPost(filePath);  // upsertPost already logs and re-throws
} else {
    await removePost(filePath);
}
```

Errors from `upsertPost` then propagate or are caught by the outer debounce timer (they are already logged inside `upsertPost`), without triggering `removePost`.

## Triage

- Decision: `VALID`
- Notes: Root cause confirmed. Single try/catch wraps both `stat()` and `upsertPost()`, so any upsertPost failure (YAML parse error, slug conflict, etc.) incorrectly routes to `removePost`, deleting the post record even though the file still exists on disk. Fix: separated stat check into its own try/catch that sets `fileExists`, then branches on that boolean. `upsertPost` errors are now caught independently and logged as `upsert_failed` without touching the post index. New test added: `unit: upsertPost error isolation` verifies `removePost` is not called and error is logged when `upsertPost` throws.
