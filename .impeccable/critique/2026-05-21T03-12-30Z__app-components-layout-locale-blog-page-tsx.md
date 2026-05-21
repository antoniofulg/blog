---
target: homepage
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-05-21T03-12-30Z
slug: app-components-layout-locale-blog-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No loading state visible; hover shadow signals clickability; pagination shows current page |
| 2 | Match System / Real World | 4 | Plain language throughout; locale-aware date; no jargon |
| 3 | User Control and Freedom | 3 | Nav + pagination provide escape; no back-to-top on long pages |
| 4 | Consistency and Standards | 3 | Eyebrow pattern consistent with About/Post; card-only-title-links breaks card=link web standard |
| 5 | Error Prevention | 3 | Pagination disabled state prevents invalid navigation; read-only page, minimal exposure |
| 6 | Recognition Rather Than Recall | 3 | Posts visible; zero tag filtering; no search; discovery fully linear |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no filtering; no RSS link visible; no accelerator path for returning readers |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; editorial eyebrow + display composition; minor orphan risk on subtitle |
| 9 | Error Recovery | 3 | EmptyState and 404 exist; no user-input errors possible |
| 10 | Help and Documentation | 2 | No RSS link; no inline author callout; About reachable from nav but not contextually |
| **Total** | | **29/40** | **Good** |

## Anti-Patterns Verdict

Not AI slop. Eyebrow + display + lede is deliberate. PostCard without image well reads editorial. Workshop Cyan appears only on eyebrow and title-hover. No gradients, no glass, no hero metrics, no icon+heading+text cards.

## Overall Impression

Clean, opinionated, reads like a writer's index. Single biggest opportunity: the entire card should be the tap target, not just the title. On mobile, users tap description text and nothing happens.

## What's Working

1. Eyebrow → H1 → lede hierarchy. Three-step composition is distinctly Engineer's Notebook.
2. PostCard without image well. Editorial-text-only card is right for content without hero images.
3. Restrained color strategy. Workshop Cyan in two places only: eyebrow and title hover.

## Priority Issues

**[P1] Entire PostCard should be the link, not just the title**
- What: Only the title Link navigates. Card body (date, description) is not interactive.
- Why it matters: On touch devices, no hover reveals the affordance. Users tap description — nothing. Silent UX failure.
- Fix: Wrap entire article content in the Link, or use position absolute link with heading semantics.

**[P1] RSS feed not discoverable**
- What: PRODUCT.md says audience uses RSS readers. No feed endpoint. No link rel alternate. No RSS icon in nav/footer.
- Why it matters: Engineers who use feed readers will look and find nothing. This is the highest-leverage retention mechanism for a developer blog.
- Fix: Build /rss.xml endpoint + add link rel alternate to head + RSS link in footer.

**[P2] Pagination touch targets 36px x 36px**
- What: h-9 w-9 = 36px. Below 44px WCAG 2.5.5 and DESIGN.md floor.
- Fix: Change to h-11 w-11.

**[P2] EmptyState SearchX icon wrong metaphor**
- What: Magnifying glass with X implies search result. No search on this page.
- Fix: Use FileText or PenSquare.

**[P3] "Blog" as H1 is a generic page-type label**
- What: H1 = "Blog" names page type, not voice. Eyebrow already says "ARTICLES."
- Fix: Change H1 to "Writing" / "Notes" or demote to smaller scale.

## Persona Red Flags

**Jordan (First-Timer):** Taps date — nothing. Taps description — nothing. Eventually taps title. Silent touch failure on two-thirds of card surface.

**Casey (Mobile):** 36px pagination targets. Full card tap fails on description. Two P-level issues compound on mobile.

**The Curious Engineer (project-specific):** Looks for RSS in header/footer. Finds nothing. Tries /rss.xml — 404. Leaves without subscribing. Primary retention failure for this audience.

## Minor Observations

- max-w-5xl fine at 1440px; may feel isolated at 2560px developer monitors.
- WipBanner + eyebrow = two accent elements close together when banner visible. Temporary concern.
- Subtitle may orphan "tooling." at some viewports.
- No post count shown (optional "3 articles" below subtitle would set expectations).

## Questions to Consider

- "If a returning engineer visits every week via RSS, what is the path right now? Is it acceptable to make them remember the URL?"
- "Should the entire PostCard be a link, or only the title? What would you have to undo?"
- "What does 'Blog' do for you as an H1 that 'Writing' or 'Notes' doesn't?"
