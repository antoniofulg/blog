---
provider: manual
pr:
round: 6
round_created_at: 2026-05-08T20:30:04Z
status: resolved
file: app/db/indexer.ts
line: 51
severity: low
author: claude-code
provider_ref:
---

# Issue 004: deriveLang accepts any directory name without validating against LOCALES

## Review Comment

`deriveLang` (line 51–53) extracts the parent directory name and returns it as a `string`:

```typescript
function deriveLang(filePath: string): string {
  return basename(dirname(filePath));
}
```

The return type is `string`, not `Locale`. At the call site (line 77), the result is stored as `lang` and inserted directly into the `posts` table — also typed `string` via the schema's `text("lang")`. If a content file is placed in an unsupported directory (e.g., `content/fr/post.mdx` or `content/post.mdx`), `deriveLang` silently returns `"fr"` or `"content"` respectively, which gets persisted to the DB.

This has two effects:
1. The row with `lang='fr'` will never appear in any public query (which filter by `eq(posts.lang, lang)` where `lang` is a valid `Locale`), so the post is silently invisible.
2. If the same slug already exists in `lang='en'`, the `UNIQUE(slug, lang)` constraint allows the bogus row — no error, just an orphaned row.

The CI frontmatter lint (`mdx.test.ts`) validates required fields and category, but does not validate the directory name.

Fix: validate the derived lang value against `LOCALES` and throw if invalid, so the indexer surfaces the misconfiguration immediately rather than silently producing invisible posts:

```typescript
import { LOCALES, type Locale } from "#/lib/locale";

function deriveLang(filePath: string): Locale {
  const dir = basename(dirname(filePath));
  if (!(LOCALES as readonly string[]).includes(dir)) {
    throw new Error(
      `Unsupported locale directory "${dir}" in path ${filePath}. Expected one of: ${LOCALES.join(", ")}`,
    );
  }
  return dir as Locale;
}
```

Update `indexer.test.ts` to add a test: calling `upsertPost` with a file path under an unknown directory (e.g., `content/fr/post.mdx`) should throw and not call `db.insert`.

## Triage

- Decision: `valid`
- Notes: Confirmed — `deriveLang` returns any `string` with no validation. Fix: import `LOCALES`/`Locale` from `#/lib/locale`, throw `Error` on invalid directory name, return `Locale`. Side effect: existing `unit: upsertPost` tests use flat `fixtures/hello.mdx` and `fixtures/no-slug.mdx` paths whose parent dir is "fixtures" (invalid locale) — these would break. Fix: create `fixtures/en/hello.mdx` and `fixtures/en/no-slug.mdx`, update those 3 test call-sites to use locale-prefixed paths. Also update `unit: syncAll` tests to use locale-structured tmpDir paths. Add new test: `upsertPost` with `fr/` parent dir throws and does not call `db.insert`.
