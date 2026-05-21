---
target: 404
total_score: 29
p0_count: 0
p1_count: 0
timestamp: 2026-05-21T13-27-33Z
slug: app-routes-root-tsx-notfoundpage
---
## Design Health Score

| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 4 |
| 2 | Match System / Real World | 4 |
| 3 | User Control and Freedom | 3 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 2 |
| 6 | Recognition Rather Than Recall | 3 |
| 7 | Flexibility and Efficiency | 2 |
| 8 | Aesthetic and Minimalist Design | 3 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | 2 |
| Total | | 29/40 |

## Anti-Patterns Verdict

404 number in accent at display scale near hero-metric territory but escapes: status code not vanity metric, universally expected pattern, heading below not small tracked label. Functional correctness wins.

## Overall Impression

Does exactly what a 404 needs. Gaps: no personality, no suggestions, not connected to blog voice. Page is conventional not distinctive.

## What's Working

1. Large status code + bilingual copy. Visual hierarchy communicates error in one second.
2. strings[lang] locale detection from pathname. Bilingual 404 with URL-based locale. Thoughtful.
3. Focus ring on CTA + aria-hidden on icon. Accessible.

## Priority Issues

**[P2] No entrance animation — inconsistent with other pages**
- Fix: 404 span 0ms → h1 + body + button block 80ms. Simple 2-step.

**[P2] Go home / Ir para o início — off-brand copy**
- Fix: strings.ts: en.homeCta → "← Writing", pt-br.homeCta → "← Escrita". Matches consistent navigation label.

**[P3] 404 at text-9xl (128px) very large on desktop**
- Optional reduction to text-8xl.

**[P3] Body copy generic**
- "The page you are looking for does not exist." → more human: "Nothing here. Check the URL or head back to the writing."

**[P3] Home icon adds no value**
- Remove or swap to ArrowLeft to match Writing navigation pattern.

## Persona Red Flags

Jordan: Single purpose works. No red flags.
Curious Engineer: No search, no suggestions. Feature gap not design issue.

## Minor Observations

- Locale detection from URL segment correct
- CTA button 44px touch target ✓
