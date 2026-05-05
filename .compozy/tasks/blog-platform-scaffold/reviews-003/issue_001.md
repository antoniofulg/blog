---
provider: manual
pr:
round: 3
round_created_at: 2026-05-05T17:23:50Z
status: resolved
file: app/routes/index.tsx
line: 142
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: CategoriesSection links pass category param to /blog which no longer filters

## Review Comment

Round 2 issue_003 removed the category filter UI from `blog.tsx` — `validateSearch` and the `activeCategory` state are gone. However, `CategoriesSection` in `index.tsx` still links to `/blog` with a `category` search parameter:

```tsx
<Link
  key={cat.name}
  to="/blog"
  search={{ category: cat.name }}   // ← sent, but /blog ignores it
  ...
>
```

The `HeroSection` link at line 60 also passes `search={{ category: undefined }}`.

When a visitor clicks the "Front-end" category card, they are navigated to `/blog?category=Front-end`. The blog page receives this URL, ignores the `category` param entirely (no `validateSearch`, no filtering logic), and renders all published posts. The URL looks like it should produce filtered results but does not. This is a broken UX expectation introduced by the round-2 fix that removed filtering from `blog.tsx` without updating the links in `index.tsx`.

**Fix** (choose one):

1. **Remove `search` from the category links** so they simply navigate to `/blog` without a dangling param:
   ```tsx
   <Link key={cat.name} to="/blog" ...>
   ```
   Add a TODO comment noting that `search={{ category: cat.name }}` should be restored when the `Post` schema gets a `category` field and the filter is re-wired.

2. **Remove the `CategoriesSection` link wrapper** and make the cards non-navigating (styled `<div>`) until category filtering is implemented. This makes the placeholder intent visible.

Option 1 is the minimal fix: the link still works (navigates to `/blog`), the URL is clean, and the intent for future wiring is documented.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed. Round 2 removed `validateSearch` and all category filtering from `blog.tsx`, but `CategoriesSection` still passed `search={{ category: cat.name }}` on each Link, and `HeroSection` passed `search={{ category: undefined }}`. Both params are silently ignored by the router, producing URLs that look filtered but are not. Fix applied: removed `search` prop from `HeroSection` Link (line 61); removed `search={{ category: cat.name }}` from `CategoriesSection` Links (line 142) and added a JSX comment in the grid div noting when to restore the param. Comment placed outside the `.map()` callback to keep JSX valid. Biome format (trailing newline on `search.tsx` was a separate fix), lint, and tsc all pass. The 4 `indexer-integ` test failures are pre-existing DB state issues confirmed present on the baseline branch before these changes.
