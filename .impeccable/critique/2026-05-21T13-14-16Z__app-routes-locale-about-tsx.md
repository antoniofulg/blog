---
target: about page
total_score: 33
p0_count: 0
p1_count: 0
timestamp: 2026-05-21T13-14-16Z
slug: app-routes-locale-about-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | SSR stable; no async interactions |
| 2 | Match System / Real World | 4 | Plain language throughout |
| 3 | User Control and Freedom | 3 | Header nav provides exit |
| 4 | Consistency and Standards | 3 | Correct pattern; zero entrance animation vs homepage/post cascade |
| 5 | Error Prevention | 3 | Missing avatar removes layout anchor silently |
| 6 | Recognition Rather Than Recall | 4 | All content on one short page |
| 7 | Flexibility and Efficiency | 3 | Social links give contact paths |
| 8 | Aesthetic and Minimalist Design | 4 | Portrait + prose + links. Nothing extra. |
| 9 | Error Recovery | 3 | TranslationNotice handles fallback; avatar absence silent |
| 10 | Help and Documentation | 3 | Social links = contact paths |
| Total | | 33/40 | Good |

## Anti-Patterns Verdict

Not AI slop. Name as H1 is identity-first. Square portrait, not circle. Inter single-family. Two HR rules create three zones. Engineer's Notebook holds.

## Overall Impression

Short, clean, honest. ~150 words intentionally thin. Biggest gap: every other page has entrance cascade; about page is static. Jarring on navigation from homepage or post.

## What's Working

1. Name as H1 at display scale. Identity-first, not page-type label.
2. Three-zone structure via two HR rules. Identity / Content / Connections.
3. SocialLink components. Iconified, 44px, focus rings, rel=noopener.

## Priority Issues

**[P2] No entrance animation**
- What: Homepage and post page both have animate-fade-up cascade. About page flash-renders.
- Why: Visiting homepage then about page switches from smooth cascade to instant render. Perceived as "afterthought."
- Fix: animate-fade-up cascade — eyebrow 0ms → H1 80ms → tagline 160ms → portrait 240ms → HR+prose 300ms → social links 360ms.

**[P2] Missing avatar silently removes layout anchor**
- What: {frontmatter.avatar && <figure>} — absent avatar removes the 192px portrait zone, changing page rhythm.
- Fix: Render placeholder div h-48 w-48 rounded-lg border border-border bg-muted when avatar absent.

**[P3] article missing aria-labelledby**
- What: Post page has aria-labelledby="post-title". About page article has no accessible name.
- Fix: aria-labelledby="about-name" on article, id="about-name" on h1.

**[P3] H1 clamp(2.5rem,7vw,4.5rem) exceeds DESIGN.md Display spec**
- What: System Display = clamp(2rem,4.5vw,3rem) max 48px. About H1 max 72px. Post H1 max 56px.
- Design decision, not a bug — confirm if intentional.

## Persona Red Flags

Jordan: Flash-render after smooth homepage. "This page was an afterthought" impression.
Curious Engineer: Post → About navigation switches from cascade to flash. Cognitive dissonance.

## Minor Observations

- figure has no figcaption (correct — alt text covers it)
- Updated date text-xs is small but supplementary
- Bio and Now H2 render identically — MDX constraint, would need component customization
