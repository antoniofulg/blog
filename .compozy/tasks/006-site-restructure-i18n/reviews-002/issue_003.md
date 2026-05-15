---
provider: manual
pr:
round: 2
round_created_at: 2026-05-15T13:16:14Z
status: resolved
file: app/lib/mdx/about.server.ts
line: 17
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: aboutFrontmatterSchema hardcodes locale enum literals

## Review Comment

`app/lib/mdx/about.server.ts:17` defines the schema with a literal enum:

```
export const aboutFrontmatterSchema = z.object({
  title: z.string(),
  locale: z.enum(["en", "pt-br"]),
  links: z.array(linkSchema).optional().default([]),
});
```

The two locale values are duplicated from `LOCALES` in `app/lib/locale.tsx:11`. ADR-007 (Implementation Notes) explicitly states:

> The schemas use `LOCALES` as the source for `z.enum(LOCALES)` so adding a locale to `app/lib/locale.tsx` propagates automatically.

The implementation diverges from the ADR. If a third locale is added to `LOCALES` (e.g., `"es"`), the post pipeline picks it up automatically via `app/db/indexer.ts:deriveLang`, but the About frontmatter schema continues to reject it — `aboutFrontmatterSchema.parse` would throw a ZodError for any `content/es/about.mdx` even though the file is valid. The bug only surfaces when a new locale is added, which is the worst time to discover it.

The other Zod schema in scope, `uiStringsSchema` in `app/lib/i18n/strings.ts`, does NOT have this drift risk because it uses `Record<Locale, UIStrings>` and a `for...of LOCALES` validation loop — the locale set is derived. About is the only schema that hardcodes the list.

**Suggested fix**: derive the enum from `LOCALES`. Zod v4 supports `z.enum(LOCALES)` directly when `LOCALES` is a tuple type. The current declaration `LOCALES: readonly Locale[] = ["en", "pt-br"]` returns a `readonly string[]` which Zod's type inference may not accept; convert to a `const` tuple:

```
// in app/lib/locale.tsx
export const LOCALES = ["en", "pt-br"] as const satisfies readonly Locale[];

// in app/lib/mdx/about.server.ts
locale: z.enum(LOCALES),
```

If the tuple change in `locale.tsx` ripples too widely, an alternative is to spread into a fresh tuple at the schema site:

```
locale: z.enum([...LOCALES] as [Locale, ...Locale[]]),
```

Either approach keeps the schema in sync with the locale registry. Add a unit test that constructs `aboutFrontmatterSchema` and confirms `parse({ locale: LOCALES[LOCALES.length - 1], title: "x" })` succeeds for every member of `LOCALES`, not just hardcoded strings — this would catch future drift.

## Triage

- Decision: `valid`
- Notes: `about.server.ts:17` hardcodes `z.enum(["en", "pt-br"])`. If a locale is added to `LOCALES` in `locale.tsx`, the schema silently rejects it. Fix: change `LOCALES` declaration in `locale.tsx` to `as const` (produces a readonly tuple Zod can use), then replace the hardcoded enum with `z.enum(LOCALES)`. Need to verify the `as const` change doesn't break `LOCALES.includes()` call in `locale.tsx:36,62` — `includes` on `readonly Locale[]` still works with a `ReadonlyArray<Locale>`. Also add a test in `about.test.ts` that iterates `LOCALES` and parses each member, to catch future drift.
