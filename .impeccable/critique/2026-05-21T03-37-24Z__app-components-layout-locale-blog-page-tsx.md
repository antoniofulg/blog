---
target: homepage
total_score: 33
p0_count: 0
p1_count: 0
timestamp: 2026-05-21T03-37-24Z
slug: app-components-layout-locale-blog-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Sidebar tracks active month via IntersectionObserver |
| 2 | Match System / Real World | 4 | Changelog metaphor instantly legible to engineers |
| 3 | User Control and Freedom | 3 | Sidebar month links; no mobile back-to-top |
| 4 | Consistency and Standards | 3 | Full-row link fixed. Day number missing time element |
| 5 | Error Prevention | 3 | Read-only; no input errors possible |
| 6 | Recognition Rather Than Recall | 4 | Sidebar lists months with counts; click to jump |
| 7 | Flexibility and Efficiency | 3 | Sidebar shortcuts; RSS fixed; no year keyboard shortcut |
| 8 | Aesthetic and Minimalist Design | 4 | Log rows; day column; lightweight month rules |
| 9 | Error Recovery | 3 | FileText EmptyState; 404 exists |
| 10 | Help and Documentation | 2 | RSS in footer fixed; no inline onboarding |
| **Total** | | **33/40** | **Good — +4 from v1** |

## Anti-Patterns Verdict

Not AI slop. Changelog/log layout with scroll-aware sidebar is uncommon and deliberate. Day column creating vertical alignment is a typographic decision. Month separator is horizontal rule, not side-stripe.

## Overall Impression

Layout is more distinctive and more useful than the old card grid. Scroll-tracking sidebar solves discoverability and orientation simultaneously. Gets better with content volume. Biggest remaining gap: mobile navigation and missing time element.

## What's Working

1. Scroll-aware sidebar. IntersectionObserver + aria-current + accent highlight is functional orientation, not decoration.
2. Day column typographic rhythm. Fixed w-7 left column creates ledger-entry scanability.
3. Log layout vs card grid. "Working notes" register vs "content marketing blog" — correct for this PRODUCT.md.

## Priority Issues

**[P2] Post rows missing time element — semantic regression**
- What: Day number is a plain span. No time dateTime attribute. PostCard had time element.
- Why: Screen readers can't announce date. Search engines lose publication date signal.
- Fix: Wrap day in time dateTime={isoDate}.

**[P2] Mobile has no navigation for long archives**
- What: Sidebar hidden on mobile. At current scale fine. At 50+ posts, mobile has no year/month jump.
- Why: Engineers read on weekends, likely mobile. Without navigation, archive discovery breaks.
- Fix: Horizontal year-chip row below subtitle on mobile, smooth-scroll to section.

**[P3] No total post count visible**
- What: No "12 articles" total shown anywhere.
- Fix: Small foreground-muted count below lede.

## Persona Red Flags

**Jordan:** Understands chronology immediately. Full-row link works. ✓
**Casey (mobile):** Clean at 1 post. At 30+ posts with no sidebar, scroll is the only navigation. P2 materializes at scale.
**Curious Engineer:** RSS auto-discovered. Sidebar navigation works. Layout value increases with volume.

## Minor Observations

- hover:bg-surface delta subtle on light theme but title accent is primary affordance signal.
- scroll-mt-24 correct at all viewport heights.
- last:mb-0 and last:border-0 handle trailing artifacts.
