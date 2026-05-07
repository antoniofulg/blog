---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T01:24:57Z
status: resolved
file: .agents/rules/routes.md
line: 9
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: routes.md extraction threshold conflicts with `$slug.tsx` current state

## Review Comment

`routes.md` states:

> Public routes ($slug.tsx, blog.tsx, etc.) may keep server fns inline if the file stays under ~80 lines and has <= 2 server fns. **Extract when either limit is exceeded.**

`app/routes/$slug.tsx` is currently 116 lines with 2 inline `createServerFn` calls and direct `db.*` imports — the 80-line limit is already exceeded. But the PRD explicitly defers `$slug.tsx` extraction to V2 ("$slug.tsx server function extraction — borderline case, V2 decision").

The rule file contains no mention of this V2 exception. Any future developer or agent reading `routes.md`, then looking at `$slug.tsx`, will see a 116-line route with inline server fns and direct DB imports, conclude it violates the rule, and may create unnecessary extraction tickets or incorrectly start refactoring the file.

**Fix:** Add a V2 exception note immediately after the threshold statement:

```markdown
## File structure
...
Public routes ($slug.tsx, blog.tsx, etc.) may keep server fns inline if the
file stays under ~80 lines and has <= 2 server fns. Extract when either limit
is exceeded.

> **Known exception:** `app/routes/$slug.tsx` currently exceeds 80 lines and
> has inline server fns. Extraction is deferred to V2 (borderline case per
> PRD-0004 non-goals). Do not extract it without a dedicated task.
```

## Triage

- Decision: `valid`
- Notes: `$slug.tsx` is 115 lines with 2 inline `createServerFn` calls and direct `db.*` imports — the 80-line rule is exceeded. No mention of V2 deferral exists in `routes.md`. A future agent will see the violation and may attempt unnecessary extraction. Fix: add a "Known exception" note after the threshold statement.
