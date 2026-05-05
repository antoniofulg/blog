---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: pending
file: app/routes/blog.tsx
line: 57
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Blog category filter UI is non-functional — filteredPosts always equals allPosts

## Review Comment

`blog.tsx` renders a row of category filter buttons that each call `setActiveCategory(cat)`. However, `filteredPosts` is unconditionally assigned `allPosts` at line 57:

```tsx
const filteredPosts = allPosts;
```

`activeCategory` is never applied as a filter predicate. Clicking any category button updates the button's highlighted state but produces no change in the displayed post list. The `"Todos"` and any named category show identical results.

This is a correctness bug: the UI promises behavior (category filtering) that it does not deliver, and users who discover this will lose trust in the whole UI.

**Fix**: Apply `activeCategory` as a filter on `allPosts`. Since posts do not have a `category` field in the DB schema, the filter would need to either:
- Match against frontmatter tags/categories when they are added to the schema, or
- Be removed from the UI until the data model supports it.

As an immediate fix, remove the category buttons until filtering is backed by real data:

```tsx
// Remove the filter buttons section and the activeCategory state until
// a `category` or `tags` field exists on Post.
```

Alternatively, if the category filter is intentional future UI, add a disabled state and a tooltip explaining it is not yet active.

## Triage

- Decision: `UNREVIEWED`
- Notes:
