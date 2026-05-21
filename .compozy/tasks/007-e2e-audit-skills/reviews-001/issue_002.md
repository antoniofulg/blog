---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/content-audit/checks.server.ts
line: 46
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Hardcoded LOCALE_PREFIXES duplicates locale source of truth

## Review Comment

`app/lib/content-audit/checks.server.ts:46` declares `LOCALE_PREFIXES = ["/en/", "/pt-br/"]` as a module-level constant. The canonical locale set lives in `app/lib/locale.tsx` as `LOCALES = ["en", "pt-br"] as const`, which is the only source of truth referenced elsewhere (`site-model.server.ts:7`, `i18n/strings.ts`, every route's locale resolution). Adding a third locale (e.g. `es`) requires touching `LOCALES` plus this hardcoded list; missing the second edit silently breaks broken-link detection for the new locale — links beginning with `/es/<slug>` will not have their leading prefix stripped, so `extractSlugFromPath` returns the full path-with-prefix, fails the `knownSlugs.has(slug)` check, and produces false-positive broken-link findings on every Spanish post link.

This contradicts ADR-004 (site-model as the single producer of route/post knowledge) and the broader "shared inventory" principle of ADR-001. The site-model module already imports `LOCALES` and uses it correctly; the audit checks should do the same.

**Suggested fix:** import `LOCALES` from `#/lib/locale` and derive the prefixes at runtime: `const LOCALE_PREFIXES = LOCALES.map((l) => \`/\${l}/\`)`. Add a unit test that adds a third fake locale via test scaffolding and asserts the broken-link check resolves slugs correctly for the new prefix. Apply the same derivation in `extractSlugFromPath`.

## Triage

- Decision: `valid`
- Notes: Confirmed at `checks.server.ts:46`. `LOCALE_PREFIXES = ["/en/", "/pt-br/"]` is hardcoded while `site-model.server.ts` already imports `LOCALES` from `#/lib/locale`. Adding a third locale to `LOCALES` would not update this constant, causing false-positive broken-link findings for the new locale prefix. Fix: import `LOCALES` and derive `const LOCALE_PREFIXES = LOCALES.map((l) => \`/\${l}/\`)`. Adding a locale-prefixed link fixture test to verify slug extraction works correctly.
