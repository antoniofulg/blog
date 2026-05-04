---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: resolved
file: app/routes/admin/index.tsx
line: 63
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: PostRow toggle has no error handling — silent failure on network error

## Review Comment

`handleToggle` calls `togglePublished` and immediately updates local state without awaiting a success response or catching errors:

```typescript
const handleToggle = async () => {
    const next = !isPublished;
    await togglePublished({ data: { id: post.id, isPublished: next } });
    setIsPublished(next);
    setSuccessMsg(next ? "Published" : "Unpublished");
    setTimeout(() => setSuccessMsg(null), 2000);
};
```

If the server call throws (network error, DB failure, auth expiry), the `await` rejects, the component does not catch the rejection, and React logs an unhandled promise rejection to the console. The UI shows neither an error nor a revert — `isPublished` and `successMsg` are not updated because the throw short-circuits after `togglePublished` but before the `setIsPublished` call. However, the button still appears in the pre-toggle state (correct), while the actual server value may have partially changed depending on when the error occurred.

More importantly, if the error occurs after the DB write succeeds (e.g., response deserialization fails), the server state and local UI state diverge permanently until the page is reloaded.

**Fix**: Wrap in a try/catch and revert local state on failure:

```typescript
const handleToggle = async () => {
    const next = !isPublished;
    try {
        await togglePublished({ data: { id: post.id, isPublished: next } });
        setIsPublished(next);
        setSuccessMsg(next ? "Published" : "Unpublished");
        setTimeout(() => setSuccessMsg(null), 2000);
    } catch {
        setSuccessMsg("Error — please try again");
        setTimeout(() => setSuccessMsg(null), 3000);
    }
};
```

## Triage

- Decision: `valid`
- Notes: `handleToggle` had no try/catch around `togglePublished`. On server error, the `await` rejects and short-circuits before `setIsPublished`/`setSuccessMsg`, producing an unhandled promise rejection with no user feedback. Fixed by wrapping in try/catch: on success, state updates as before; on catch, shows "Error — please try again" for 3s and leaves `isPublished` at its pre-toggle value (no state divergence). Biome auto-sorted imports in the file during the `check` run (pre-existing lint issue). 2 pre-existing warnings in `app/tests/task-04-seed.test.ts` unrelated to this change. All 132 tests pass.
