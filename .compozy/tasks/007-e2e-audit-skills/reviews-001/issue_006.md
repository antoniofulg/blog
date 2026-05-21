---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/site-model.server.ts
line: 201
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: getPostInventory silently skips malformed MDX

## Review Comment

`getPostInventory` (`app/lib/site-model.server.ts:193-204`) wraps each file's frontmatter parse in `try { … } catch {}`. Any MDX file whose frontmatter fails to parse (missing `title`, malformed YAML, invalid locale directory) is silently omitted from the returned inventory.

This has two compounding effects on the audit pipeline:

1. `checkFrontmatter` (`checks.server.ts:79-108`) is invoked on the raw `findMdxFiles` walk, so it does catch and report the same malformed files. So far OK.
2. However, **every other check** (`checkTranslationGaps`, `checkBrokenLinks`, `checkMissingAltText`, `checkSeriesGaps`) consumes `getPostInventory()` output (`checks.server.ts:224, 235-238`). A malformed file silently drops out of those checks. The result: a translation twin can disappear without the audit noticing, a published-but-malformed post can have a broken series with no series-gap finding, and broken-link checks miss links inside posts whose frontmatter happened to fail.

The downstream effect is selective audit blindness: you get a `frontmatter-invalid` finding for the broken file, fix that one issue, and the next run still misses every consequence the malformed file caused for translation parity / link integrity / series consistency until the file is fully fixed.

**Suggested fix:** when frontmatter parsing fails in `getPostInventory`, either (a) include a partial `PostEntry` with `frontmatter: {}` and a sentinel flag so downstream checks can decide whether to include it, or (b) log a structured warning to stderr with the file path and re-raise as a typed error the caller (`runContentAudit`) catches and converts into a `frontmatter-invalid` finding once, removing the silent path entirely. Option (b) is preferred because it preserves a single source of truth for "malformed" findings.

## Triage

- Decision: `valid`
- Notes: Confirmed at `site-model.server.ts:201`. The `catch {}` silently discards parse errors. `checkFrontmatter` independently scans all file paths and DOES emit frontmatter-invalid findings, so findings are not lost. But the silence makes debugging harder and the existing integration test (`audit-content-cli.test.ts`) checks `stderr: ""` for a clean tree — which stays passing because on a clean tree no errors occur. Fix: change `catch {}` to `catch (err) { process.stderr.write(...) }` to surface errors without changing skip behavior. The integration test with `stderr: ""` only runs when port 5432 is occupied; with a clean content tree, no errors fire, so that test remains passing.
