---
provider: manual
pr:
round: 1
round_created_at: 2026-05-15T13:01:46Z
status: resolved
file: app/components/layout/header.tsx
line: 11
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Header and footer nav still link to deleted /blog route

## Review Comment

After Phase 2 deletions (task_07), `/blog` is no longer a registered route — the post listing now lives at `/{-$locale}/` (i.e., `/` for en, `/pt-br/` for pt-br). The `{-$locale}` layout in `app/routes/{-$locale}.tsx:7-9` rejects single-segment paths that are not in `LOCALES` with `throw notFound()`, so `/blog` returns 404.

Three nav references still point at this dead URL:

1. `app/components/layout/header.tsx:11` — `NAV_LABELS.en` entry `{ label: "Blog", to: "/blog" }`.
2. `app/components/layout/header.tsx:16` — `NAV_LABELS["pt-br"]` entry `{ label: "Blog", to: "/blog" }` (note: this also targets `/blog`, not `/pt-br/` — so pt-br users hit 404 too).
3. `app/components/layout/footer.tsx:6` — `navLinks` entry `{ label: "Blog", to: "/blog" }`.

Every visitor clicking the primary "Blog" nav link from any page lands on a 404. This is a regression introduced by Phase 2 that task_02's nav cleanup did not catch — task_02 removed `Tutorials` and `Projects` entries but left the `Blog` entry pointing at what was then a working redirect shim. After task_07 deleted that shim, the link became broken.

**Suggested fix**: update the three entries to point at the locale-aware index route. For the header, the existing `useLangSwitcher` pattern already navigates with `to: "/{-$locale}"` and `params: { locale }`; the NAV_LABELS table cannot encode that directly because TanStack Router `<Link to=>` expects either a static string or a typed route. Two options:

- Change the table to `{ label: "Blog", to: "/{-$locale}", params: { locale } }` and have the JSX spread params per locale, OR
- Replace the static `to: "/blog"` with the locale-aware href computed via `localeHref(currentLocale)` from `app/lib/locale.tsx:19`. For en this returns `"/"`, for pt-br `"/pt-br/"`. Render via `<a href=>` instead of `<Link to=>` if the typed router signature gets in the way.

Footer fix is the same pattern. Also consider whether "Home" and "Blog" should remain as separate nav items at all — they now point at the same URL.

Integration test should curl `/blog` and assert 404, and curl `/` (or `/pt-br/`) and assert the post feed renders — these would have caught the regression.

## Triage

- Decision: `valid`
- Notes: Confirmed `header.tsx:11` en and `header.tsx:16` pt-br both have `{ label: "Blog", to: "/blog" }`. The `/blog` route was deleted in Phase 2 task_07; the post listing now lives at `/{-$locale}/`. Since "Home" already points to `"/"` (the en blog index), removing "Blog" from both locale NAV_LABELS eliminates the broken link without introducing a duplicate nav item. The footer Blog link (`footer.tsx:6`) is also broken for the same reason — that file is in scope and the fix will be applied there too while editing footer for issue_004.
