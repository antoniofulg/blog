---
provider: manual
pr:
round: 10
round_created_at: 2026-05-20T18:06:08Z
status: resolved
file: app/components/layout/header.tsx
line: 118
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Header buttons (theme toggle, mobile menu) lack discernible text

## Review Comment

`make audit-fe` reports 4 axe `button-name` violations across `/` and `/pt-br` for both auth states — same root cause repeated:

```
## a11y-violation
- **a11y-violation** (`http://localhost:4173/`)
  - button-name: Ensure buttons have discernible text
- **a11y-violation** (`http://localhost:4173/pt-br`)
  - button-name: Ensure buttons have discernible text
```

Inspecting `app/components/layout/header.tsx`, three buttons live in the desktop header bar:

1. **Line 110 — Language switcher** ✓ Has `aria-label="Switch language"` AND visible `<span>{label}</span>` text. Passes.
2. **Line 118 — Theme toggle** ✗ Contains only `<Sun />` or `<Moon />` Lucide icon. No `aria-label`, no `aria-labelledby`, no visible text. **axe fails here.**
3. **Line 129 — Mobile menu toggle** ✗ Contains only `<Menu />` icon. No `aria-label`. **axe fails here.**

The mobile-menu close button (line 163) uses `<span className="sr-only">{mobileStrings.closeMenu}</span>` plus visible `✕` — that pattern is axe-compliant and is not the source.

So the two failing buttons are the theme toggle and the mobile menu toggle in the desktop header.

## Why this matters

- **Screen-reader users cannot identify the buttons.** A blind user lands on the page, tabs to the header, hears "button. button. button." with no clue which is theme vs menu vs language. Critical UX failure.
- **WCAG 2.1 SC 4.1.2 (Name, Role, Value) — Level A.** Failure here means the site cannot claim WCAG 2.1 A conformance, let alone AA which is the project's stated bar (per `.agents/rules/fe-audit.md` axe tags `wcag2a,wcag2aa,wcag22aa`).
- **Mobile menu toggle is the primary nav on small screens.** Without it labelled, the entire mobile site is functionally inaccessible to screen-reader users — they cannot open the nav drawer.
- **Pattern bug, not one-off.** Same omission likely repeats in any future icon-only button added to the codebase. Worth landing a lint rule or a wrapper component (`<IconButton aria-label="…">`) as a follow-up.

## Suggested fix

Add localized `aria-label` to both buttons. The locale-aware string table already exists in `MOBILE_STRINGS` (header.tsx:20-32) — extend it so desktop buttons can reuse the same labels:

```ts
const HEADER_STRINGS: Record<Locale, { toggleTheme: string; openMenu: string }> = {
    en:      { toggleTheme: "Toggle theme",   openMenu: "Open menu" },
    "pt-br": { toggleTheme: "Alternar tema",  openMenu: "Abrir menu" },
};
```

Then in the Header component:

```tsx
const headerStrings = HEADER_STRINGS[currentLocale];

// theme toggle button (line 118)
<button
    type="button"
    onClick={toggle}
    aria-label={headerStrings.toggleTheme}
    aria-pressed={theme === "dark"}
    className="…"
>

// mobile menu toggle button (line 129)
<button
    type="button"
    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
    aria-label={headerStrings.openMenu}
    aria-expanded={mobileMenuOpen}
    aria-controls="mobile-menu"
    className="…"
>
```

Adding `aria-pressed` on the theme toggle and `aria-expanded` / `aria-controls` on the menu trigger is a free a11y upgrade — they were already needed for proper toggle / disclosure semantics. The `id="mobile-menu"` on the `MobileMenu` container completes the `aria-controls` wiring.

## Suggested follow-up (out of scope here)

Create a `<IconButton>` wrapper in `app/components/ui/` that requires `aria-label` as a non-optional prop, then refactor existing icon-only buttons to use it. Locks the lesson in via TypeScript so future contributors can't repeat the omission. File as a separate task — not blocking this fix.

## Acceptance criteria

1. `make audit-fe` reports zero `button-name` violations under `## a11y-violation`.
2. `tests/e2e/` or `app/tests/` includes an axe assertion that the header passes `button-name` on both locales.
3. Theme toggle has `aria-pressed` reflecting current state.
4. Mobile menu toggle has `aria-expanded` + `aria-controls="mobile-menu"`, and `MobileMenu` has `id="mobile-menu"`.
5. All four added strings are translated for `en` AND `pt-br`.

## Triage

- Decision: `valid`
- Notes: Confirmed. Theme toggle (line 118) and mobile menu toggle (line 129) have no `aria-label`. `MOBILE_STRINGS` already defines `toggleTheme` for both locales; adding `openMenu`/`Abrir menu` covers the menu button. Fix: extend `MOBILE_STRINGS` with `openMenu`, look up strings in `Header` via `MOBILE_STRINGS[currentLocale]`, add `aria-label` + `aria-pressed` to theme toggle and `aria-label` + `aria-expanded` + `aria-controls="mobile-menu"` to menu toggle, add `id="mobile-menu"` to `MobileMenu` container. Also fix the mobile-drawer theme toggle which similarly lacks `aria-label`.
