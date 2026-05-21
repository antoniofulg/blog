---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: tests/e2e/auth-flow.spec.ts
line: 16
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: e2e specs depend on hardcoded Portuguese UI strings

## Review Comment

The Playwright specs assume the rendered UI uses Portuguese strings for shared interactive elements:

- `tests/e2e/auth-flow.spec.ts:16` — `page.getByLabel("Senha")` (password field)
- `tests/e2e/auth-flow.spec.ts:17, 39` — `page.getByRole("button", { name: /Entrar/i })` (submit)
- `tests/e2e/admin-write.spec.ts:80, 82, 91, 93` — `getByRole("button", { name: /Publicar|Despublicar/i })` (publish toggle)

The auth-flow tests explicitly opt out of admin storageState (`tests/e2e/auth-flow.spec.ts:9`), so the locale-resolution path is: cookie (none) → Accept-Language → `DEFAULT_LOCALE` (`en` per `app/lib/locale.tsx:DEFAULT_LOCALE`). The tests are therefore relying on either (a) Playwright's default Accept-Language preferring `pt-br` (it normally sends `en-US,en;q=0.9`) or (b) the unauthenticated login page rendering Portuguese form labels by some path I cannot see. Either way, the dependency is implicit. A change to Playwright defaults, browser locale settings on CI runners, or the app's locale resolution order would break every login-based spec with no signal that the issue is locale, not auth.

This also conflicts with `.agents/rules/testing.md`'s selector hierarchy guidance: `getByRole`/`getByLabel` are correct, but the **name** argument needs to be stable across user locales. Hardcoded strings in any single language fail this property.

**Suggested fix:** introduce a test-side i18n helper that imports `app/lib/i18n/strings.ts` (or the actual labels from `app/lib/i18n`) and exposes locale-correct strings to specs, OR explicitly set the locale before each spec via `await page.context().addCookies([{ name: 'locale', value: 'en', url: '...' }])` so the UI is deterministically English (and update the selectors to match). Pick one and codify in `.agents/rules/testing.md`. Add `data-testid` attributes on the publish/unpublish toggle as a final fallback if i18n bleed cannot be controlled (testing.md already permits `data-testid` as the last resort in the hierarchy).

## Triage

- Decision: `invalid`
- Notes: The review comment assumes the login page labels are locale-sensitive. Inspection of `app/routes/login.tsx` shows the label `"Senha"` (line 79) and button text `"Entrar"` (line 103) are **hardcoded Portuguese strings** — they are not rendered through any i18n system or locale detection. `detectLocaleFromRequest` is not called in the login component; the labels are static JSX string literals. Therefore `page.getByLabel("Senha")` and `getByRole("button", { name: /Entrar/i })` are stable selectors that will not break regardless of Playwright locale settings, Accept-Language headers, or locale cookies. No code change needed.
