# Content Audit Rules

## Scope

`content-audit` is a **filesystem-only** skill. It walks `app/content/posts/**/*.mdx`
and validates MDX source files. It does NOT render pages, launch a browser, or
check runtime DOM. For runtime accessibility checks, use `a11y-testing` instead.

> **content-audit ≠ a11y-testing**: these skills cover different surfaces.
> `content-audit` = MDX source layer (frontmatter, links, alt text in source).
> `a11y-testing` = browser DOM layer (rendered output, WCAG compliance, axe-core).
> Run both independently; they do not overlap.

## Coverage Matrix

| Check | Locale | Published | Drafts | Opt-out |
|-------|--------|-----------|--------|---------|
| `frontmatter-invalid` | en + pt-br | yes | yes | none |
| `translation-gap` | en only | yes | yes | `noTranslation: true` |
| `broken-link` | en + pt-br | yes | yes | none |
| `missing-alt-text` | en + pt-br | yes | yes | none |
| `series-gap` | en + pt-br | yes | yes | none |

Note: the anonymous × admin × locale × route group matrix from ADR-001 is OBSOLETE
for this skill. That matrix applies to `e2e-coverage` (browser sessions).
`content-audit` uses the filesystem-only matrix above.

## Category Definitions

| Category | Severity | Trigger condition |
|----------|----------|------------------|
| `frontmatter-invalid` | blocker | Required field missing or wrong type: `title` (string), `date` (ISO date), `slug` (string), `published` (boolean) |
| `translation-gap` | major | en post exists with no `app/content/posts/pt-br/<slug>.mdx` twin AND frontmatter lacks `noTranslation: true` |
| `broken-link` | major | Internal link target (`[text](path)` or JSX `<Link href="">`) has no matching file in `app/content/posts/` |
| `missing-alt-text` | minor | `<img>` element or `![](url)` markdown image has empty or missing `alt` attribute/text |
| `series-gap` | minor | Posts sharing a `series` frontmatter key have non-contiguous `part` numbers (e.g., parts [1, 3] with no part 2) |

External URLs (starting with `http://` or `https://`) are excluded from `broken-link`
checks — only internal relative paths are validated.

## Severity Scheme

| Severity | Exit code | CI behavior | Resolution SLA |
|----------|-----------|-------------|----------------|
| blocker | 1 | Workflow fails | Before merge |
| major | 0 | Workflow passes; PR comment posted | Before promotion from draft |
| minor | 0 | Workflow passes; PR comment posted | Batch-fix acceptable |

## Output Paths

| Artifact | Path | Committed |
|----------|------|-----------|
| Per-run report | `docs/_reports/content-audit-YYYY-MM-DD.md` | No (gitignored) |
| Audit history | `docs/audits/SUMMARY.md` | Yes |

`docs/_reports/` is in `.gitignore`. Never commit individual run reports.

## Finding Row Format

Per-run report finding format:

```markdown
- **<category>** (`<relative-filePath>` line <N>)
  - <human-readable message>. <suggested fix>.
```

SUMMARY.md row format (append-only; never edit existing rows):

```markdown
| YYYY-MM-DD | <trigger> | <blocker-count> | <major-count> | <minor-count> | <top-finding> |
```

## Abort Condition

Evaluate the abort condition when **two consecutive audit runs** both produce zero
actionable findings (blocker + major = 0). Record the evaluation decision in `docs/audits/SUMMARY.md`
as a note row. If the corpus remains stable for a full quarter with zero findings,
retire this skill. Document retirement in the ADR log.

V2 successor: `app-audit` (browser-sweep using Playwright; validates routes, auth
redirects, rendered accessibility). Was the original ADR-001 scope; deferred by ADR-002.
