---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: resolved
file: app/db/indexer.ts
line: 14
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Dual frontmatter parsers risk silent data inconsistency

## Review Comment

The codebase has two separate frontmatter parsers with different implementations:

1. `parseFrontmatterBlock` in `app/db/indexer.ts` (lines 14–35): a hand-rolled regex parser that extracts keys with `new RegExp(`^${key}:\\s*(.+)$`, "m")` and parses `publishedAt` via `new Date(rawString)`.

2. `parseFrontmatter` in `app/lib/mdx.server.ts` (lines 44–67): uses `gray-matter`, which parses YAML correctly and auto-converts date fields to JS `Date` objects.

The two parsers disagree on YAML edge cases:
- **Quoted strings**: `title: "Hello: World"` — gray-matter handles the colon in the value; the regex reads `"Hello` as the title (stops at `:`).
- **Multiline description**: gray-matter handles block scalars; the regex requires the value on the same line.
- **YAML dates**: `publishedAt: 2026-05-02` — gray-matter parses this as a `Date` object; the regex reads it as the raw string `2026-05-02`.

A frontmatter value that parses correctly in gray-matter (used by the MDX renderer) may fail or return a different value in the indexer's parser. This can cause the indexed `title` or `slug` in Postgres to differ from what the MDX renderer sees at render time.

**Fix**: Remove `parseFrontmatterBlock` from `indexer.ts` and reuse `parseFrontmatter` from `mdx.server.ts`. This requires making `parseFrontmatter` importable from the indexer (it already reads from disk, which matches the indexer's needs). Alternatively, extract a shared `parseFrontmatter` utility into `app/lib/frontmatter.server.ts` that both modules import.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed. `parseFrontmatterBlock` regex breaks on `title: "Hello: World"` (reads `"Hello` instead of `Hello: World`), multiline YAML scalars, and YAML date literals (returns raw string instead of `Date`). `gray-matter` already installed as dep. Fix: replace regex parser in `indexer.ts` with `matter()`. No need for a shared utility — both files now use `gray-matter` so YAML semantics agree. Changes scoped to `indexer.ts` only.
