# Task Memory: task_12.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Wire UIStrings consumers in three surfaces: header locale switcher, post meta publishedOn label, NotFoundPage 404 copy.

## Important Decisions

- Exported `NotFoundPage` from `__root.tsx` (named export) to enable unit testing without extracting it to a separate file.
- Exported `LocalePostDetail` from `{-$locale}/$slug.tsx` for test discoverability; integration tests cover the actual render.
- Post meta label rendered as `<span>` inside a `<p>` wrapping both label and `<time>` — changed from bare `<time>` element.
- `NotFoundPage` field names changed: `t.heading` → `t.title`, `t.cta` → `t.homeCta` (aligning to UIStrings schema).
- Unit tests for `NotFoundPage` placed in new `not-found-page.test.ts` (jsdom env) with heavy mocks on `@tanstack/react-devtools`, `@tanstack/react-router-devtools`, `@tanstack/react-start`, `@tanstack/react-start/server`, and layout components.

## Files / Surfaces

- `app/components/layout/header.tsx` — `strings[targetLocale].localeSwitcher.label` replaces `"PT"/"EN"`
- `app/routes/{-$locale}/$slug.tsx` — `strings[requestedLang].postMeta.publishedOn` label added; component exported
- `app/routes/__root.tsx` — `strings[lang].notFound.*` replaces inline `copy` object; `NotFoundPage` exported
- `app/tests/header.test.ts` — label assertions updated to `"Português"` / `"English"`
- `app/tests/not-found-page.test.ts` — new, 8 unit tests for `NotFoundPage` (jsdom)
- `app/tests/lang-slug-route.test.ts` — 2 integration tests for `postMeta.publishedOn` label (skipIf port 3000 free)
- `app/tests/public-routes.test.ts` — 2 integration tests for locale-aware 404 UIStrings (skipIf port 3000 free)

## Errors / Corrections

- First cut of `not-found-page.test.ts` imported `React` as default; Biome flagged `useImportType`. Fixed by splitting to `import type { ReactNode }` + `import { createElement }`.

## Ready for Next Run

Task 12 complete. All verification passed (lint, typecheck, tests). Pre-existing baseline: 14 failing DB-only tests. No new failures introduced.
