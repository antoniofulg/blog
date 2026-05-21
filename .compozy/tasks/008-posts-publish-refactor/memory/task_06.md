# Task Memory: task_06.md

Keep only task-local execution context here.

## Objective Snapshot

DONE. Extended `checks.server.ts` with `slug-collision` finding + page enumeration + `translation-gap` for pages.

## Important Decisions

- Pages have no `noTranslation` opt-out (`PageFrontmatter` only has `title`+`description`). All en-only pages get `translation-gap`.
- `slug-collision` severity = major.
- `checkPageTranslationGaps` and `checkSlugCollisions` are pure exported functions — take `pagesByLocale: Partial<Record<Locale, PageEntry[]>>` as arg.
- `runContentAudit` calls `enumerateStaticPages(locale)` for each LOCALE.
- Biome `useLiteralKeys` requires `pagesByLocale.en` (dot notation) but bracket notation for `pagesByLocale["pt-br"]` (hyphen can't be dot-accessed).

## Files / Surfaces

- `app/lib/content-audit/checks.server.ts` — added `slug-collision` to FindingCategory + 2 new exported functions + wired into `runContentAudit`
- `.agents/rules/audit.md` — Coverage Matrix split into Posts/Pages sections; Category Definitions updated
- `app/tests/content-audit-checks.test.ts` — new: 17 tests (6 unit checkPageTranslationGaps, 7 unit checkSlugCollisions, 4 integration runContentAudit)

## Ready for Next Run

Committed. Task 07 is next (dialog primitive).
