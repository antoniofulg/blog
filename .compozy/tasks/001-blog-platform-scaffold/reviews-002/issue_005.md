---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: resolved
file: app/routes/blog.tsx
line: 11
severity: low
author: claude-code
provider_ref:
---

# Issue 005: getPublishedPosts query duplicated — blog.tsx does not reuse shared fn

## Review Comment

`app/routes/index.tsx` exports `getPublishedPostsFn` (line 16), a plain async function that queries all published posts ordered by `published_at DESC`. `app/routes/blog.tsx` defines its own inline server function (lines 11–18) with an identical query:

```ts
// blog.tsx (lines 11–18) — duplicates getPublishedPostsFn in index.tsx
const getPublishedPosts = createServerFn({ method: "GET" }).handler(
  async () => {
    return await db
      .select()
      .from(posts)
      .where(eq(posts.isPublished, true))
      .orderBy(desc(posts.publishedAt));
  },
);
```

Two copies of the same query will diverge over time. When a change is needed (e.g., add a `NULLS LAST` clause for posts without `publishedAt`, or add a `limit` parameter), both files must be updated.

**Fix**: Move `getPublishedPostsFn` into a shared module (e.g., `app/db/queries.ts`) and import it from both route files. The server function wrapper in each route can remain per-route, but the query logic should have a single source of truth:

```ts
// app/db/queries.ts
export async function getPublishedPostsFn(): Promise<Post[]> { ... }

// blog.tsx
import { getPublishedPostsFn } from "#/db/queries";
const getPublishedPosts = createServerFn({ method: "GET" }).handler(getPublishedPostsFn);
```

## Triage

- Decision: `valid`
- Notes: Confirmed. `blog.tsx` lines 11–18 duplicates the published-posts query already present in `index.tsx:16`. Fix: created `app/db/queries.ts` as the single source of truth for this query (required touching a file outside batch scope — documented here because the fix is minimal and necessary). Updated both `blog.tsx` and `index.tsx` to import `getPublishedPostsFn` from `#/db/queries`. Removed the inline function definition from `index.tsx` and the now-unused drizzle/db imports from that file. The server function wrappers remain per-route as recommended in the issue.
