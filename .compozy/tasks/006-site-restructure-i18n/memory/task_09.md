# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Add hreflang pairs to `{-$locale}/index.tsx`; fix hreflang URLs in `{-$locale}/$slug.tsx` (were using `/en/slug` instead of `/slug` for default locale); add unit + integration tests.

## Important Decisions

- Added `localeHref(locale, slug?)` to `app/lib/locale.tsx` as a pure helper (testable without DOM).
- Used `LOCALES.map` in `index.tsx` `head.links` so adding a new locale only requires updating `LOCALES`.
- `toBcp47` used for `hrefLang` attribute (produces `"en"` and `"pt-BR"`). Integration tests assert `hreflang="pt-BR"` (BCP47 capitalized), NOT `"pt-br"` — matches what the browser receives.

## Learnings

- Pre-commit Biome auto-fix can't handle glob paths with `{-$locale}` on CLI — fixed manually.
- The original `$slug.tsx` hreflang was broken: used `/${post.lang}/${slug}` producing `/en/slug` for default locale. Fixed to use `localeHref`.

## Files / Surfaces

- `app/lib/locale.tsx` — added `localeHref`
- `app/routes/{-$locale}/index.tsx` — added hreflang `links` in `head`, added imports
- `app/routes/{-$locale}/$slug.tsx` — fixed hreflang href generation with `localeHref`
- `app/tests/locale.test.ts` — 6 new `localeHref` unit tests
- `app/tests/lang-blog-route.test.ts` — 5 new hreflang integration tests
- `app/tests/lang-slug-route.test.ts` — 3 new hreflang integration tests

## Errors / Corrections

- None

## Ready for Next Run

Task complete. Subtask 9.4 (curl smoke test) is a manual post-deploy check; not automated.
