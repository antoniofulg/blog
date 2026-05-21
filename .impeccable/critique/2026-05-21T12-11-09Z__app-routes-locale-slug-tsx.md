---
target: post page
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-05-21T12-11-09Z
slug: app-routes-locale-slug-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No reading progress — long posts give zero position feedback |
| 2 | Match System / Real World | 4 | Natural language; meta strip clear |
| 3 | User Control and Freedom | 3 | Back link top, exit footer; no in-prose escape |
| 4 | Consistency and Standards | 3 | All posts / Browse all posts / Writing — three labels, one destination |
| 5 | Error Prevention | 3 | viewCount inflates every mount, no session guard |
| 6 | Recognition Rather Than Recall | 3 | Back link visible; no TOC (deliberate) |
| 7 | Flexibility and Efficiency | 2 | No section jumping, no shortcuts, no copy-link |
| 8 | Aesthetic and Minimalist Design | 4 | prose-lg, max-w-3xl, clean code slabs, Engineer's Notebook |
| 9 | Error Recovery | 3 | notFoundComponent + TranslationNotice |
| 10 | Help and Documentation | 2 | No TOC (deliberate); no related posts |
| **Total** | | **29/40** | **Good** |

## Anti-Patterns Verdict

Not AI slop. Eyebrow cascade, prose-lg, dark code blocks — deliberate. Two uppercase tracked labels (header eyebrow + footer caption) borderline acceptable as structural markers.

## Overall Impression

Post page reads right. Single biggest gap: no reading progress for long posts. Homepage solved orientation with sidebar timeline; post page solves nothing.

## What's Working

1. PostHeader composition clean. Back link → eyebrow → display → lede → meta.
2. Prose typography correct. prose-lg, max-w-3xl, heading hierarchy matches DESIGN.md.
3. PostFooter calm exit. No upsell, no social rail. Honors reading-is-the-experience.

## Priority Issues

**[P1] No reading progress signal**
- What: Long posts give zero position feedback. TOC banned (sidebar). No progress bar.
- Why: Engineer reading on weekend with interruptions loses place, leaves.
- Fix: position:fixed top:0 height:2px Workshop Cyan progress bar. scaleX() from scrollY. prefers-reduced-motion disables.

**[P2] Three labels one destination**
- What: PostHeader = All posts. PostFooter = Browse all posts. H1 = Writing.
- Fix: Align to one label everywhere. Recommend "← Writing" to match H1.

**[P2] viewCount inflates every mount**
- What: useEffect fires on every hydration. 10 refreshes = 10 increments.
- Fix: sessionStorage gate — check "viewed-{id}" before calling incrementViewCount.

**[P2] PostFooter End of article label overexplains**
- What: "End of article" label before date. Border-t rule already signals end.
- Fix: Remove label. Or replace with author name linking to /about.

**[P3] Meta strip gap-y-1 too tight on mobile wrap**
- Fix: gap-y-2.

**[P3] my-12 rule oversized on mobile**
- Fix: my-8 lg:my-12.

**[P3] PostFooter Browse all posts button ~36px touch target**
- Fix: py-2 → py-3 or min-h-[44px].

## Persona Red Flags

Jordan: reads long post, phone interrupts, returns — can't find place. Zero orientation signal.
Casey: meta wrap 4px gap too tight. PostFooter button 36px < 44px minimum.
Curious Engineer: finishes post, only exit = back to list. Discovery dead-ends without series/tags.

## Minor Observations

- article missing aria-labelledby pointing to H1
- viewCount fire-and-forget, network failure silently drops count
- prose-p:text-foreground-secondary contrast 8.6:1 ✓
