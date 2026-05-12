---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/routes/$lang/$slug.tsx
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Route file violates inline server-fn and DB-import rules

## Review Comment

`app/routes/$lang/$slug.tsx` is 170 lines and contains two `createServerFn` calls plus direct `db.*` imports (`#/db/client`, `#/db/schema`). Project route rules (`CLAUDE.md`, `.agents/rules/routes.md`) state:

> "Public routes may keep server fns inline if the file stays under ~80 lines **and** has <= 2 server fns."
> "Prohibited in *.tsx route files: `createServerFn()` calls, direct `db.*` imports."

At 170 lines both conditions for the inline exception are violated (only the second is borderline; the first is clearly exceeded). The known exception documented in routes.md applies only to `app/routes/$slug.tsx`, not to new route files.

Extract server functions and DB access to `app/routes/$lang/$slug.server.ts`:

```
app/routes/$lang/$slug.server.ts  ← getPostBySlugWithLangFn, incrementViewCountFn,
                                     createServerFn wrappers, db imports
app/routes/$lang/$slug.tsx        ← Route definition, component, imports from .server.ts
```

This mirrors the admin route pattern and brings the route file back under ~80 lines.

## Triage

- Decision: `valid`
- Notes: Confirmed — `app/routes/$lang/$slug.tsx` is 170 lines with 2 `createServerFn` calls and direct `#/db/client`+`#/db/schema` imports. Known exception in routes.md only covers `app/routes/$slug.tsx`, not new routes. Fix: extract `getPostBySlugWithLangFn`, `incrementViewCountFn`, server fn wrappers, and all DB/FS imports to `app/routes/$lang/$slug.server.ts` (new file — minimally required outside batch scope, documented here). Update test import path in `app/tests/lang-slug-route.test.ts` from `"#/routes/$lang/$slug"` to `"#/routes/$lang/$slug.server"`.
