---
provider: manual
pr:
round: 2
round_created_at: 2026-05-07T01:38:07Z
status: resolved
file: .agents/rules/auth.md
line: 23
severity: low
author: claude-code
provider_ref:
---

# Issue 003: "ADR-001 in blog scaffold" reference is ambiguous — no file path

## Review Comment

`auth.md` line 23 contains:

```markdown
reactStartCookies plugin MUST be last in the plugins array (ADR-001 in blog scaffold)
```

The reference "ADR-001 in blog scaffold" is ambiguous for two reasons:

1. Task 004 has its own `adrs/adr-001.md` (scope document: "V1 scope bounded to server fn extraction + shared auth util + docs"). An agent searching for ADR-001 in the current task directory finds the wrong document.
2. No file path is given — the actual document lives at `.compozy/tasks/001-blog-platform-scaffold/adrs/adr-001.md`, which is not obvious from the inline reference.

**Fix:** Replace the vague inline reference with a relative link that resolves correctly:

```markdown
reactStartCookies plugin MUST be last in the plugins array
(see [ADR-001, blog-platform-scaffold](../../.compozy/tasks/001-blog-platform-scaffold/adrs/adr-001.md))
```

Or, if cross-task links are too brittle, replace with an inline note:

```markdown
reactStartCookies plugin MUST be last in the plugins array — this plugin
mutates response cookies and must run after all other plugins have processed
the response.
```

## Triage

- Decision: `valid`
- Notes: The ADR file exists at `.compozy/tasks/001-blog-platform-scaffold/adrs/adr-001.md` but the inline reference "ADR-001 in blog scaffold" is ambiguous — task 004 has its own `adr-001.md`. Chose the inline-note approach over a cross-task relative link to avoid brittleness. Replaced with: "it mutates response cookies and must run after all other plugins have processed the response".
