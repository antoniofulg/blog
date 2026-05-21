---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/site-model.server.ts
line: 213
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: hasTwin requires every other locale, couples to locale count

## Review Comment

`getPostInventory` computes `hasTwin` as `otherLocales.every((l) => slugsByLocale[l]?.has(slug))` (`site-model.server.ts:213-214`). With the current two-locale set (`en` + `pt-br`), this is equivalent to "the single counterpart locale has the slug" — correct.

The moment a third locale is added (PRD-007 has the locale list as variable; `LOCALES` is a `const` exported from `app/lib/locale.tsx`), the semantics change: a post needs to exist in **all** other locales to clear the twin check. Suddenly every en post that has no `es` translation (likely most posts initially) is reported as `translation-gap` even though the pt-br twin exists. The audit's first run after adding `es` produces an avalanche of false positives equal to the count of en posts + pt-br posts, and the abort condition ("two consecutive zero-actionable-finding runs ⇒ retire") becomes structurally unreachable until every post is translated to every locale.

This couples the audit's behavior to the locale set in a way that the current ADRs (002, 004) do not intend: ADR-002 frames translation-gap as a binary "missing counterpart" check, not a "missing in any locale" check.

**Suggested fix:** change `hasTwin` semantics to "at least one other locale has this slug" — i.e. `otherLocales.some((l) => slugsByLocale[l]?.has(slug))`. Alternatively, introduce an explicit per-post `requiredLocales` frontmatter field that defaults to `LOCALES` but can be narrowed (e.g. `requiredLocales: ["en", "pt-br"]` on a post that intentionally skips `es`). Document the chosen semantics in `.agents/rules/audit.md`. Add a unit test that fakes a third locale via test scaffolding and asserts the existing two-locale posts do not regress to twin-missing.

## Triage

- Decision: `valid`
- Notes: Confirmed at `site-model.server.ts:214`. `otherLocales.every(...)` requires the post to exist in ALL other locales. With 2 locales (en, pt-br), every === some, so current behavior is correct. With 3+ locales, `every` would require all non-source locales to have the translation, making `hasTwin=false` for any post missing even one locale — flooding findings at locale-set expansion time. ADR-002 frames it as binary "missing counterpart" which maps to `some`. Fix: change `every` to `some`. No existing test breaks (2-locale scenario is identical under both). Add a note to the test. A true 3-locale behavioral test would require mocking LOCALES and is noted but deferred.
