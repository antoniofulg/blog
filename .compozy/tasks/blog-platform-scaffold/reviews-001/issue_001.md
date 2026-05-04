---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: pending
file: app/routes/admin/index.tsx
line: 34
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Admin server functions expose unauthenticated HTTP endpoints

## Review Comment

`getAllPosts` and `togglePublished` are `createServerFn` calls compiled to real HTTP POST endpoints under TanStack Start's `/_start/` prefix. The route's `beforeLoad` guard only prevents the browser from rendering the dashboard UI — it does not protect the server function endpoints themselves. An unauthenticated caller who discovers the endpoint URLs can invoke either function directly via `fetch`, bypassing the login requirement entirely.

`getAllPosts` (line 34) leaks all post metadata including drafts. `togglePublished` (line 38–40) lets any caller flip any post's `isPublished` flag.

The same pattern exists in `app/routes/admin/preview.$slug.tsx` line 26: `getAdminPreview` is also unprotected.

**Fix**: Add an auth check inside each server function handler, not only in `beforeLoad`. Example:

```typescript
const togglePublished = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; isPublished: boolean }) => input)
  .handler(async ({ data }) => {
    const { auth } = await import("#/lib/auth");
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) throw new Response("Unauthorized", { status: 401 });
    return togglePublishedFn(data.id, data.isPublished);
  });
```

Apply the same pattern to `getAllPosts` and `getAdminPreview`.

## Triage

- Decision: `UNREVIEWED`
- Notes:
