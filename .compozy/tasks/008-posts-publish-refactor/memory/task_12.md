# Task Memory: task_12.md

## Objective Snapshot

Update `buildLocaleHead` in `app/lib/locale.tsx` to emit hreflang tags conditionally:
- Homepage → x-default + both locale alternates
- Content with both twins → both locale alternates
- Content without twin → no hreflang
Wire through `$slug.tsx` page head for hasTwin conditional emission.

## Important Decisions

- `HreflangDescriptor` union: `"homepage" | "has-twin" | "no-twin"`. Default = `"no-twin"`.
- Homepage routes (`{-$locale}/index.tsx`, `en.index.tsx`, `pt-br.index.tsx`) pass `{ kind: "homepage" }`.
- `$slug.tsx` post hreflang: already correct (conditional on `alternateLang`). No change needed.
- `$slug.tsx` page hreflang: was `links: []` always; fix to use `hasTwin` boolean from `PageLoaderResult`.
- hreflang hrefs: relative URLs via `localeHref()`, matching existing post hreflang pattern.
- x-default href: always `"/"` (EN homepage), regardless of which locale variant calls it.
- Existing test "alternate hreflang links present for all locales" → updated to use `{ kind: "homepage" }`.

## Files / Surfaces

- `app/lib/locale.tsx` — add `HreflangDescriptor`, update `buildLocaleHead`
- `app/routes/{-$locale}/index.tsx` — pass `{ kind: "homepage" }`
- `app/routes/en.index.tsx` — pass `{ kind: "homepage" }`
- `app/routes/pt-br.index.tsx` — pass `{ kind: "homepage" }`
- `app/routes/{-$locale}/$slug.tsx` — fix page hreflang (use `hasTwin`)
- `app/tests/locale.test.ts` — update existing + add new hreflang tests

## Status

**COMPLETE.** 56 test files pass, 996 tests pass. Committed.

## Learnings

- `buildLocaleHead` is only called from index routes; `$slug.tsx` manages its own hreflang inline.
- `LOCALE_PATHNAME["en"] = "/"`, `LOCALE_PATHNAME["pt-br"] = "/pt-br/"` — same as `localeHref(l)`.
- Sitemap uses `SITE_URL` with absolute URLs; head hreflang uses relative URLs (consistent with existing post pattern).
