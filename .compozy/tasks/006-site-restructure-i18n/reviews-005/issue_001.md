---
provider: manual
pr:
round: 5
round_created_at: 2026-05-15T13:43:50Z
status: resolved
file: app/components/ui/category-card.tsx
line: 4
severity: low
author: claude-code
provider_ref:
---

# Issue 001: CategoryCard component is dead code

## Review Comment

`app/components/ui/category-card.tsx` exports a `CategoryCard` component, but a repository-wide `grep -rn "CategoryCard"` returns only the export declaration itself — **no other file imports it**:

```
$ grep -rn "CategoryCard" app/
app/components/ui/category-card.tsx:4:export function CategoryCard({
```

The component is reachable from `app/components/ui/` but unused. Most likely history: it was originally imported by the now-deleted `/projects` or `/tutorials` routes (task_03 deleted those routes); the route deletions removed the importers but left the component file behind.

What makes this more notable than typical dead code: `category-card.tsx` appears in the `git diff main...HEAD --name-only` for this PRD, meaning it was **modified during the route restructure** (likely the inline `to="/{-$locale}"` at line 17 was updated as part of the bulk `$lang/*` → `{-$locale}/*` rename in task_06). Effort was spent editing a file that no consumer references — both at modification time and at the next reader's first encounter with the codebase.

Component also contains hardcoded Portuguese copy:

```
<span className="text-xs text-foreground-secondary">{count} artigos</span>
```

So if the intent is to revive it for V2, the i18n contract (`UIStrings` per ADR-001) would need extending to cover the `"artigos"`/`"articles"` label. Right now the file is in limbo: not wired up, partially i18n-ready.

PRD F1 enumerated deletions explicitly:
- `app/routes/tutorials.tsx`, `tutorials.$seriesSlug.tsx`, `projects.tsx`, `newsletter.tsx`, `search.tsx`
- `app/components/tutorial-step.tsx`

`category-card.tsx` was not on the list, likely an oversight when the deletion sweep was scoped — it shares the same "orphan after route deletion" property as `tutorial-step.tsx`.

**Suggested fix** (pick one):

1. **Delete** `app/components/ui/category-card.tsx`. The component is unused and removing it eliminates dead code, future confusion, and the wasted modification in this PRD's history. Verify with `git grep CategoryCard` after deletion (should return zero matches).

2. **Wire it back into the UI** if categories were a planned V1 feature that got cut. The blog post feed at `/{-$locale}/index.tsx` could render a row of category cards above the post grid, sourcing the list from `posts.category` aggregations. This is feature scope creep relative to V1, so option 1 is cleaner.

3. **Move to a `_unused/` graveyard** if there is a desire to preserve the work-in-progress component for a near-term future feature. Not idiomatic; option 1 is preferred and git history preserves the file regardless.

Severity is low because dead code does not change runtime behavior (no consumer = no bundle inclusion in production builds). Flagging because the file silently increases cognitive load for next contributors and because its presence in the PRD diff suggests the V1 deletion sweep was incomplete.

## Triage

- Decision: `valid`
- Notes: Grep confirms zero importers — only the export declaration itself matches. Component was modified during task_06's `$lang/*` → `{-$locale}/*` rename but has no consumers since the `/projects` and `/tutorials` routes were deleted in task_03. Also contains hardcoded Portuguese copy (`artigos`) violating ADR-001 i18n contract. Fix: delete the file. Git history preserves it for future reference. No tests exist for this component; no test changes needed. Pre-existing test failures (14 failing in sync-integ, indexer-integ, drizzle-schema) confirmed present on branch before this change — DB unique constraint state issue, unrelated to this fix.
