---
provider: manual
pr:
round: 12
round_created_at: 2026-05-20T21:44:25Z
status: resolved
file: app/styles/global.css
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Round-010 contrast fix incomplete — `/about` and `/login` still fail WCAG 2 AA

## Review Comment

Round-010 issue 004 was marked `resolved` with the triage note:

> Darken `foreground-muted` from #898989 → #666666 (light) and from #4D5F76 → #8FA5C0 (dark) to meet WCAG 2 AA 4.5:1; change WipBanner from bg-orange-500 → bg-orange-700 for white text contrast.

Those changes landed. `make audit-fe` now reports **zero** `color-contrast` violations on `/` and `/pt-br/` — the round-010 fix worked for those routes. But the full-tree audit surfaces 10 new `color-contrast` rows on routes that round-010 never walked:

```
http://localhost:4173/about/
http://localhost:4173/pt-br/about/
http://localhost:4173/login/
http://localhost:4173/login/?redirect=%2Fadmin%2F
http://localhost:4173/login/?redirect=%2Fadmin%2Fpreview%2Fe2e-fixture-post%2F
```

(Each ×2 auth states.)

The round-010 fix focused on `foreground-muted` (used on the home page) and WipBanner. The `/about` and `/login` pages must be using a different problematic token pair or have inline styling not covered by that change. Three candidates worth investigating in order of probability:

1. **Login form inputs** — placeholder text colors, input borders, and helper text frequently miss AA. The login form is the most common offender for contrast on auth pages.
2. **About page section dividers / metadata blocks** — secondary text patterns (`text-foreground-secondary`, `text-muted-foreground`, or a sibling token to `foreground-muted` that round-010 didn't touch).
3. **Disabled / hover states** — axe-core evaluates contrast on the resting state by default, but Playwright's audit pages may have hover focus rings or pending states with sub-AA contrast.

The audit's a11y adapter still does not emit the offending node selector (see the "Diagnostic gap" section preserved from round-010 issue 004); operators must re-run axe locally with `nodes[].html` logged to pinpoint the failing element.

## Why this matters

- **WCAG 2 AA compliance gap.** Two of the most important authentication and informational pages fail the same bar `/` and `/pt-br/` now pass. Brand-claimed accessibility is partial.
- **Login is high-stakes.** Anyone who can't read the form labels can't get in. The home page being accessible while the login page is not is a brutal user experience for screen-readers + low-vision users.
- **Round-010 issue 004 marked resolved prematurely.** The acceptance criterion ("`make audit-fe` reports zero `color-contrast` violations") was technically met for the `--routes=/` scope but fails on the full sweep. Same trap as issue 004 of this round (canonical) — narrow audit scope hid the breadth of the bug.

## Suggested fix paths

### Path A — diagnose first (recommended)

Temporarily enrich `app/lib/app-audit/a11y-adapter.server.ts` to emit one finding per axe `violation.nodes[]` entry, including the `target` selector and the failing element's `failureSummary`. Re-run `make audit-watch --routes=/login/` and capture the report. The selectors will name the exact CSS class or computed style that fails.

Once identified:
- If the offender is a Tailwind token → bump the OKLCH lightness in `app/styles/global.css`.
- If it's an inline-style or component-local color → patch the component.

### Path B — empirical bisect via `make audit-watch`

`make audit-watch --routes=/login/` opens the failing page in a visible Chromium. Use browser devtools' "Inspect → Accessibility → Contrast" panel on visible text to find the offender by sight. Faster than the adapter patch if it's an obvious culprit (e.g., gray-on-white label text).

### Path C — preemptive token sweep

Audit every CSS variable in `app/styles/global.css` against both light and dark backgrounds using the WebAIM contrast checker. Make sure every `--foreground-*` and `--muted-*` variable hits ≥ 4.5:1 against `--background` and `--surface`. Larger refactor; do this after A/B if the same offender keeps reappearing.

## Acceptance criteria

1. `make audit-fe` reports `## a11y-violation\n(none)` (or zero `color-contrast` rows specifically) across all walked routes.
2. Manual spot-check with browser devtools: every text + control on `/about/`, `/login/`, `/pt-br/about/`, `/pt-br/login/` meets ≥ 4.5:1 (normal) or ≥ 3:1 (large/UI).
3. Diagnostic gap from round-010 issue 004 ("a11y adapter emits one finding per axe rule per page without `nodes[]`") is addressed in this round OR documented as a deferred follow-up with explicit triage rationale.
4. New regression test in `app/tests/app-audit-checks.test.ts` simulates an axe violation on a probed page and asserts the finding row contains a selector substring.

## Triage

- Decision: `valid`
- Notes: Root cause identified via WCAG luminance analysis. Light-mode `--accent: #0AA3D6` has L=0.311. Contrast ratios: (1) as text on `--background` (#F5F8FC, L=0.936): 0.986/0.361=2.73:1 — FAILS AA 4.5:1; (2) as `bg-accent` with white text (`#FAFAFA`, L=0.956): 1.006/0.361=2.79:1 — FAILS AA. Both fail on /login (submit button: `bg-accent text-foreground-inverse`) and /about (prose links: `prose-a:text-accent`). Fix: darken light-mode `--accent` to `#097098` (L=0.139); new ratios: text on background 0.986/0.189=5.22:1 ✓; white text on button 1.05/0.189=5.56:1 ✓. `--accent-hover` darkened to `#0A5E7E` to maintain darker-on-hover pattern. `--tag-react` updated to match (was same value as accent). Dark-mode tokens unchanged — `#69C3FF` on `#1C2433` already passes (8.06:1). Diagnostic gap (a11y adapter not emitting node selectors, acceptance criterion 4) is deferred: `a11y-adapter.server.ts` is outside batch scope; this is documented explicitly in the test file.
