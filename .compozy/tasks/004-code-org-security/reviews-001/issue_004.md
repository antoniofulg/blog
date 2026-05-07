---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T01:24:57Z
status: resolved
file: app/routes/__root.tsx
line: 19
severity: low
author: claude-code
provider_ref:
---

# Issue 004: `__root.tsx` re-exports `AuthUser`/`RouterContext` that no file imports

## Review Comment

After moving `AuthUser` and `RouterContext` to `app/types/auth.ts`, `__root.tsx` adds a re-export on line 19:

```typescript
export type { AuthUser, RouterContext };
```

A grep across the entire codebase shows no file imports these types from `__root.tsx`. The canonical import path is now `#/types/auth`, and nothing references `#/routes/__root` for these types. The re-export is dead code that creates a secondary source of truth: future developers may see it and wonder whether they should import from `#/routes/__root` or `#/types/auth`.

**Fix:** Remove line 19 entirely. The types are already importable from `#/types/auth`. If future code generation by TanStack Router needs these types re-exported from `__root`, that can be added at that point.

```typescript
// Remove this line:
export type { AuthUser, RouterContext };
```

## Triage

- Decision: `valid`
- Notes: Grepped entire `app/` — only `routeTree.gen.ts` imports from `__root.tsx`, and it imports `Route` not the types. No consumer imports `AuthUser` or `RouterContext` from `#/routes/__root`. Re-export on line 19 is dead code that creates a secondary source of truth. Fix: remove the line.
