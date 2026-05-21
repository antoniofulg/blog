---
provider: manual
pr:
round: 10
round_created_at: 2026-05-20T18:06:08Z
status: resolved
file: app/styles/global.css
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Color contrast falls below WCAG 2 AA on `/` and `/pt-br`

## Review Comment

`make audit-fe` reports 4 `color-contrast` violations — same root cause hit on both locales × both auth states:

```
## a11y-violation
- **a11y-violation** (`http://localhost:4173/`)
  - color-contrast: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
- **a11y-violation** (`http://localhost:4173/pt-br`)
  - color-contrast: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
```

The audit's a11y adapter currently emits one finding per violation rule per page but does not include the offending node selector or the computed contrast ratio in the message. That's a real limitation — see "Diagnostic gap" below — but the violation itself is genuine: axe-core would not flag this with the default `wcag2aa` ruleset unless at least one DOM node falls below 4.5:1 (normal text) or 3:1 (large text + UI components).

Suspected culprits, ordered by visibility on the home page:

1. **`text-foreground-secondary` on default background.** The Tailwind v4 design tokens define `foreground-secondary` via OKLCH lightness adjustments in `app/styles/global.css`. A small drift (e.g., L=0.55 against bg L=1.0) lands around 3.8:1 — failing AA for body text. Used in `Footer`, `MobileMenu` nav links, and the index page's secondary copy.
2. **`text-accent` on light-mode `bg-background`.** If the accent is a saturated blue/green at moderate lightness, the contrast against white can drop below 4.5:1. The `Terminal` icon + accent button text both rely on this pair.
3. **WipBanner copy.** A "work in progress" banner often uses muted yellows/oranges with poor contrast against text. Worth a direct inspection.

Verify which case applies by running axe locally with the offending nodes visible:

```bash
bunx playwright test --headed --debug tests/e2e/a11y.spec.ts
# OR temporarily augment app/lib/app-audit/a11y-adapter.server.ts to log
# violation.nodes[].html so the audit report includes the failing selector.
```

## Why this matters

- **WCAG 2.1 SC 1.4.3 — Level AA.** This is part of the project's declared compliance target. Failure means the site is not AA-conformant.
- **Body-text contrast affects everyone.** Outdoor lighting, glare, and older eyes all degrade perceived contrast further. A 3.8:1 ratio that "looks fine on my MacBook indoors" can be unreadable on a phone at noon.
- **One token fix usually clears multiple violations.** `text-foreground-secondary` is used across Footer, MobileMenu, post excerpts, etc. Bumping its OKLCH lightness once fixes every dependent surface.
- **Easy follow-up sentinel.** Once fixed, `make audit-fe` should report 0 `color-contrast` violations going forward; any future regression (e.g., a designer adjusts the token) re-surfaces immediately in the PR comment.

## Diagnostic gap (worth addressing here OR as a separate issue)

`app/lib/app-audit/a11y-adapter.server.ts` emits one finding per axe rule per page without the `violation.nodes[]` payload. That makes triage harder — there's no way to know which selector failed without re-running locally. Two options:

- **Inline enrichment.** Extend the adapter to emit one finding per node, including the selector (`nodes[i].target.join(" ")`) and the computed contrast in the message. Maps roughly 1:1 to axe's own JSON output.
- **Separate detail file.** Write full axe results to `docs/_reports/a11y-details-YYYY-MM-DD.json` alongside the markdown report; keep the markdown row count low.

Pragmatic engineer recommendation: inline enrichment. Cost is small (5-10 lines), and the markdown stays scannable because contrast violations on the same selector across locales would naturally dedupe into a single descriptive row.

## Suggested fix

Step 1 — identify offender:
```bash
# Temporary debug — log the failing selectors
node -e "
const axe = require('@axe-core/playwright');
…
"
# OR re-run audit with adapter enrichment patched in (see Diagnostic gap above)
```

Step 2 — adjust the offending token in `app/styles/global.css`. For OKLCH-based tokens, the simplest fix is bumping lightness toward darker on light backgrounds (or toward lighter on dark backgrounds). Aim for ≥ 4.5:1 with the WebAIM contrast checker.

Step 3 — verify with `make audit-fe`; the report should show 0 `color-contrast` violations.

## Acceptance criteria

1. `make audit-fe` reports zero `color-contrast` violations under `## a11y-violation`.
2. Manual spot-check with browser devtools: every text token pair on `/` and `/pt-br` has ≥ 4.5:1 contrast (normal text) or ≥ 3:1 (large 18pt+ or UI elements).
3. Dark mode verified separately — same audit run in dark theme produces no new `color-contrast` violations.
4. If diagnostic gap is addressed in this issue, `docs/_reports/app-audit-*.md` includes the failing selector in the `color-contrast` row.

## Triage

- Decision: `valid`
- Notes: Two confirmed contrast failures after manual WCAG luminance math. (1) `foreground-muted: #898989` (light) on `bg-surface: #EAECEE` → 2.95:1, fails AA for body text. Fix: darken to `#666666` → 4.83:1. Dark mode `foreground-muted: #4D5F76` on `bg-surface: #171D2A` → 2.58:1. Fix: lighten to `#8FA5C0` → 6.67:1. Both changes are in `app/styles/global.css` (in scope). (2) `WipBanner` uses Tailwind utility `bg-orange-500 text-white` → 2.80:1 (fails). This is in `app/components/layout/wip-banner.tsx` (out of scope) but fixing only global.css would leave color-contrast violations on the page. Touching wip-banner.tsx minimally (change to `bg-orange-700`) brings it to 5.17:1. Documented here per cy-fix-reviews policy.
