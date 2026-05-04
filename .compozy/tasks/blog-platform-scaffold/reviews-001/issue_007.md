---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: pending
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

- Decision: `UNREVIEWED`
- Notes:
