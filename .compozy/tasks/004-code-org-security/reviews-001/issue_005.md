---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T01:24:57Z
status: resolved
file: AGENTS.md
line: 23
severity: low
author: claude-code
provider_ref:
---

# Issue 005: AGENTS.md file structure omits `$slug.tsx` V2-deferred exception

## Review Comment

`AGENTS.md` documents the file structure with this entry for routes:

```
routes/admin/       — *.tsx (UI only) + *.server.ts (server fns)
```

This correctly describes the admin pattern established in this task. However, `app/routes/$slug.tsx` (a public route) has 116 lines with two inline `createServerFn` calls and direct `db.*` imports — the same pattern that `routes.md` instructs agents to extract when the 80-line limit is exceeded.

An agent starting a new session reads AGENTS.md, learns the routes structure, reads `routes.md`, sees the extraction rule, then opens `$slug.tsx` and finds a rule violation. Without context from the PRD non-goals, the agent may flag it, attempt to fix it, or be confused about why an apparent violation exists in a task marked "done."

The same gap exists in `routes.md` (tracked separately as issue_003). This note in AGENTS.md would provide immediate orientation without requiring the agent to find the PRD.

**Fix:** Add a note to the file structure section:

```markdown
routes/             — file-based routes; admin/ and api/ subdirs
routes/admin/       — *.tsx (UI only) + *.server.ts (server fns)
                      Note: $slug.tsx exceeds 80 lines with inline server fns —
                      extraction deferred to V2 (PRD-0004 non-goal)
```

## Triage

- Decision: `valid`
- Notes: Same gap as issue_003 but in `AGENTS.md`. An agent reading AGENTS.md first (before `routes.md`) has no indication that `$slug.tsx`'s apparent rule violation is intentional. Fix: add inline note to the routes/ section.
