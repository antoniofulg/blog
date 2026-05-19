---
provider: manual
pr:
round: 3
round_created_at: 2026-05-19T15:26:33Z
status: resolved
file: app/lib/content-audit/checks.server.ts
line: 185
severity: low
author: claude-code
provider_ref:
---

# Issue 003: missing-alt-text severity disagrees between code (major) and audit.md (minor)

## Review Comment

Round 2 issue 004 fixed the `broken-link` severity mismatch between code and `.agents/rules/audit.md` by splitting the doc row into two tiers (blocker for published, minor for draft). A second, identical mismatch in the same Category Definitions table was missed for `missing-alt-text`:

- `.agents/rules/audit.md:36` documents `| \`missing-alt-text\` | minor | \`<img>\` element or \`![](url)\` markdown image …`
- `app/lib/content-audit/checks.server.ts:185` emits `severity: "major"` for every missing alt finding

The accessibility-impact framing in PRD-007 and ADR-002 calls this a "major" concern, which matches the code, not the doc. The two should agree so SUMMARY.md severity counts, abort-condition calculations (which use `blocker + major = 0`), and developer expectations all match the same number.

This is a smaller-scope variant of round 2 issue 004 — single line on each side, no behavioral change — but missing it leaves a documented contradiction in `.agents/rules/audit.md` that confuses readers expecting alt-text findings to count as `minor` only.

**Suggested fix (doc-only):** change the severity column in `.agents/rules/audit.md:36` from `minor` to `major`:

```
| `missing-alt-text` | major | `<img>` element or `![](url)` markdown image has no alt text. |
```

Confirm the abort-condition table (audit.md L45-46) still reads correctly with alt-text counting toward the `major` total. No code or test change required. Round 1 issue 002 fix already pulled `LOCALE_PREFIXES` from `LOCALES`; this fix keeps the doc as canonical reference for severities the code actually emits.

## Triage

- Decision: `valid`
- Notes: Confirmed — `checks.server.ts:185` emits `severity: "major"` for `missing-alt-text`; `.agents/rules/audit.md:36` says `minor`. Code behavior matches PRD-007/ADR-002 intent (accessibility = major). Doc is wrong. Fix: update `audit.md:36` severity column to `major`. No code change needed.
