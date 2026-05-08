---
provider: manual
pr:
round: 6
round_created_at: 2026-05-08T20:30:04Z
status: resolved
file: app/routes/$lang/blog.tsx
line: 29
severity: low
author: claude-code
provider_ref:
---

# Issue 005: $lang/blog.tsx exceeds 80-line threshold with inline server function

## Review Comment

`app/routes/$lang/blog.tsx` is 95 lines and contains a `createServerFn` call at line 29:

```typescript
const getLocalePosts = createServerFn({ method: "GET" })
  .inputValidator((lang: string) => lang)
  .handler(({ data: lang }) => getPublishedPostsFn(lang as Locale));
```

The route rules in `.agents/rules/routes.md` state:

> "Public routes may keep server fns inline if the file stays under ~80 lines **and** has <= 2 server fns. Extract when either limit is exceeded."

At 95 lines the 80-line threshold is exceeded, triggering the extract rule. The `$lang/$slug.tsx` route was extracted to `$slug.server.ts` in round 1 issue 003 for the same reason.

The known exception in `routes.md` applies only to `app/routes/$slug.tsx` (PRD-0004 non-goal), not to new routes added in TASK-0005.

Fix: extract `getLocalePosts` to `app/routes/$lang/blog.server.ts`:

```typescript
// app/routes/$lang/blog.server.ts
import { createServerFn } from "@tanstack/react-start";
import { getPublishedPostsFn } from "#/db/queries";
import type { Locale } from "#/lib/locale";

export const getLocalePosts = createServerFn({ method: "GET" })
  .inputValidator((lang: string) => lang)
  .handler(({ data: lang }) => getPublishedPostsFn(lang as Locale));
```

Then in `$lang/blog.tsx`:
```typescript
import { getLocalePosts } from "./$lang/blog.server";
// or, co-located:
import { getLocalePosts } from "./blog.server";
```

This brings the route file under ~80 lines and aligns with the two-file pattern used in `admin/` and `$lang/$slug`.

## Triage

- Decision: `valid`
- Notes: Confirmed — `$lang/blog.tsx` is 95 lines with a `createServerFn` at line 29. Route rules require extraction when either limit is exceeded. Fix: create `app/routes/$lang/blog.server.ts` with the extracted `getLocalePosts` fn, update blog.tsx to import from it and remove `createServerFn` import. The existing `lang-blog-route.test.ts` mocks `@tanstack/react-start` globally and does not import from blog.tsx directly, so extraction does not break tests.
