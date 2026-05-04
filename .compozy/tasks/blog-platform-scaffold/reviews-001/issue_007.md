---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: resolved
file: app/routes/$slug.tsx
line: 43
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: View counter incremented on TanStack Router prefetch, not only real visits

## Review Comment

The route loader for `/$slug` increments the view counter unconditionally:

```typescript
loader: async ({ params }) => {
    const data = await getPostBySlug({ data: params.slug });
    await incrementViewCount({ data: data.post.id });
    return data;
},
```

TanStack Router prefetches routes by default when the user hovers over a `<Link>`. The `PostList` component (app/routes/index.tsx) renders `<Link to="/$slug" params={{ slug: post.slug }}>` for each post. Hovering over any post link triggers the `/$slug` loader, which calls `incrementViewCount` — inflating the count before the user has actually read the post.

For a personal blog where view counts are used to judge which content resonates (PRD F7), hover-inflate can make all posts appear more popular than they are, especially if the reader scans the post list repeatedly without clicking.

**Fix option 1**: Move `incrementViewCount` out of the loader and into the component using `useEffect`, which only runs after the component actually mounts in the browser (not during prefetch or SSR):

```typescript
function PostDetail() {
    const { post, html } = Route.useLoaderData();
    useEffect(() => {
        incrementViewCount({ data: post.id });
    }, [post.id]);
    // ...
}
```

**Fix option 2**: Disable prefetch for the post detail link specifically: `<Link preload={false} to="/$slug" ...>`.

Option 2 is simpler but degrades navigation performance; option 1 is the idiomatic solution.

## Triage

- Decision: `valid`
- Notes: Confirmed. `incrementViewCount` was called in the route loader at line 45. TanStack Router fires the loader on hover prefetch, inflating counts before actual navigation. Root cause: side-effecting mutation in a data-fetching loader. Fix: removed `incrementViewCount` call from loader; added `useEffect(() => { incrementViewCount({ data: post.id }); }, [post.id])` in `PostDetail` component. `useEffect` runs only in the browser after mount, never during SSR or prefetch. Existing tests unaffected — they test `incrementViewCountFn` directly, not the loader call site. Verification: 133 tests pass, biome check clean (2 pre-existing unrelated warnings).
