---
name: content-audit
description: >
  MDX content audit for this blog. Validates frontmatter, en↔pt-br translation
  parity, internal link integrity, image alt text, and series consistency.
  Use when asked to "audit content", "check translations", "find broken links",
  "validate frontmatter", "check missing alt text", "find series gaps", or
  "run content audit". Do NOT activate on generic "review", "audit code", or
  "audit security" phrases.
context: fork
version: 1.0.0
tags: [content, audit, mdx, frontmatter, translation, links, a11y, series]
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
user-invocable: true
---

# content-audit

Filesystem-only content audit for `blog`. Walks `app/content/posts/**/*.mdx`
via `getPostInventory()` — no browser session required. Canonical entrypoint:
`scripts/audit-content.ts`.

> **Not `a11y-testing`**: this skill validates MDX source files (content layer).
> `a11y-testing` validates runtime DOM with axe-core (browser layer). Use both
> independently — they cover different surfaces and do not overlap.

## Scope

- **Input**: `app/content/posts/{en,pt-br}/**/*.mdx` (filesystem walk)
- **No browser session** — runs entirely in Node/Bun; no Playwright required
- **No database writes** — read-only except SUMMARY.md append

## Categories

| Category | Severity | Description |
|----------|----------|-------------|
| `frontmatter-invalid` | blocker | Required fields missing or malformed (title, date, slug, published) |
| `translation-gap` | major | en post has no pt-br twin and `noTranslation: true` not set in frontmatter |
| `broken-link` | major | Internal MDX `[text](path)` or JSX `<Link href="">` resolves to no file |
| `missing-alt-text` | minor | `<img>` or `![](url)` with empty or absent `alt` attribute |
| `series-gap` | minor | A `series` frontmatter group has non-contiguous part numbers |

## Severity Scheme

- **blocker** — exit code 1; CI fails; must fix before merge
- **major** — reported; does not fail CI by default; fix before promoting draft
- **minor** — informational; batch-fix acceptable

## Output Paths

| Artifact | Path | Committed |
|----------|------|-----------|
| Per-run report | `docs/_reports/content-audit-YYYY-MM-DD.md` | No (gitignored) |
| Audit history | `docs/audits/SUMMARY.md` | Yes |

`docs/_reports/` is gitignored. `docs/audits/SUMMARY.md` is committed — one
row per run with date, trigger, severity counts, and top finding.

## Opt-Out

Set `noTranslation: true` in MDX frontmatter to suppress `translation-gap` for
a post that intentionally has no twin:

```mdx
---
title: "Post title"
noTranslation: true
---
```

## Invocation

```bash
# CLI — exits 1 if any blocker findings
bun run audit:content

# With trigger label (used by GH Action)
bun run audit:content -- --trigger="PR #42 (push)"

# Slash command (agent conversation)
/content-audit
```

The GH Action `.github/workflows/content-audit.yml` runs automatically on PRs
touching `app/content/posts/**` or `app/db/schema.ts`, and on `workflow_dispatch`.

## Finding Row Format

Each finding in the per-run report:

```markdown
- **<category>** (`<filePath>` line <N>)
  - <human-readable message>. <suggested fix>.
```

SUMMARY.md row format:

```markdown
| YYYY-MM-DD | <trigger> | <blocker> | <major> | <minor> | <top-finding> |
```

## Abort Condition

If two consecutive audit runs both produce **zero actionable findings** (blocker
+ major = 0), evaluate whether the audit adds ongoing value. If the content
corpus is stable and findings remain zero for a full quarter, retire this skill
and promote to a lighter lint rule. Document the retirement decision in
`docs/audits/SUMMARY.md`.

**V2 pivot**: if `content-audit` hits the abort condition, the natural successor
is `app-audit` — a browser-sweep skill that validates runtime behavior
(accessibility, performance, broken routes) using Playwright. `app-audit` was
the original ADR-001 scope; it was deferred in ADR-002 to prioritise
`content-audit` first.

## Run Examples

```bash
# Full run (CI-equivalent)
bun run audit:content -- --trigger="manual"

# Target a specific content dir (for testing)
bun run audit:content -- --content-dir=app/content/posts/en
```

## Related

- `scripts/audit-content.ts` — CLI entry point; exports `runAuditCli`
- `app/lib/content-audit/checks.server.ts` — 5 check functions + `runContentAudit`
- `app/lib/content-audit/reporter.server.ts` — markdown report writer + SUMMARY append
- `.agents/rules/audit.md` — severity scheme, category definitions, abort condition
- `.github/workflows/content-audit.yml` — CI surface (paths-filtered + workflow_dispatch)
- `a11y-testing` skill — non-overlapping companion (runtime DOM, not content files)
- `e2e-coverage` skill — Playwright E2E for route behavior (not content validation)
