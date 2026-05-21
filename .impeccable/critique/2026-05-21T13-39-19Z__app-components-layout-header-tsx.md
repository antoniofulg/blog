---
target: navbar
total_score: 35
p0_count: 0
p1_count: 1
timestamp: 2026-05-21T13-39-19Z
slug: app-components-layout-header-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No active state on nav links |
| 2 | Match System / Real World | 4 | Clear labels throughout |
| 3 | User Control and Freedom | 4 | Logo home, nav links, utilities always accessible |
| 4 | Consistency and Standards | 4 | Sticky, ghost buttons, mobile dialog, focus rings — all correct |
| 5 | Error Prevention | 4 | Navigation only; no destructive actions |
| 6 | Recognition Rather Than Recall | 3 | Items visible; no current-page indicator |
| 7 | Flexibility and Efficiency | 3 | Keyboard nav ✓; no page shortcuts |
| 8 | Aesthetic and Minimalist Design | 4 | Logo · nav · utilities. Nothing extra. |
| 9 | Error Recovery | 4 | No interactive errors possible |
| 10 | Help and Documentation | 3 | ARIA labels on all controls |
| Total | | 35/40 | Good |

## Anti-Patterns Verdict

Not AI slop. Terminal icon in Workshop Cyan only brand mark. Ghost utilities correct weight. Two-item nav reads as editorial restraint. LanguageMenu custom disclosure, not select reflex.

## Overall Impression

Strong. Well-structured, accessible, on-brand. One gap: no active state on nav links.

## What's Working

1. Logo lockup: Terminal icon + name. DESIGN.md aligned.
2. LanguageMenu ARIA: haspopup, expanded, current, keyboard nav complete.
3. MobileMenu role=dialog aria-modal. Correct semantics.
4. Theme toggle aria-pressed. State communicated every render.

## Priority Issues

**[P1] No active state on nav links**
- What: "Home" and "About" visually identical on any page. No aria-current="page", no color change.
- Why: WCAG 2.4.8 (Location, AA). Header gives no orientation signal.
- Fix: useRouterState to match pathname vs link.to. If match: text-accent font-medium + aria-current="page".

**[P2] Logo link missing destination context in accessible name**
- What: "Antonio Fulgencio, link" — no "home" context.
- Fix: aria-label="Antonio Fulgencio — home" on logo Link.

**[P3] Ghost utility buttons 40px — below 44px platform convention**
- What: h-10 w-10 meets WCAG 2.5.8 (24px) but not 44px iOS/Android convention.
- Fix: h-11 w-11 on theme toggle, mobile menu trigger. LanguageMenu trigger h-11.

## Persona Red Flags

Curious Engineer: navigates to About, header shows identical links, slight disorientation.
Sam (screen reader): no aria-current="page" on active nav link announced.

## Minor Observations

- px-6 lg:px-20 matches content area
- h-16 sticky header; scroll-mt-24 accounts for it
- Mobile nav h-13 (52px) > 44px minimum
- Mobile theme label visible
- WipBanner + logo icon both Workshop Cyan — within 10% rule, banner dismissible
