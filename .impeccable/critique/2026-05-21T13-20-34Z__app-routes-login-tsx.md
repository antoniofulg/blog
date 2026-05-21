---
target: login
total_score: 28
p0_count: 0
p1_count: 0
timestamp: 2026-05-21T13-20-34Z
slug: app-routes-login-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Pending text-only, no spinner — 3s silence on VPS cold-start |
| 2 | Match System / Real World | 3 | Login/Email (en) + Senha/Entrar (pt-br) — mixed registers |
| 3 | User Control and Freedom | 3 | Admin dead-end by design; header provides exit |
| 4 | Consistency and Standards | 4 | Focus rings, 44px, autoComplete, required — correct |
| 5 | Error Prevention | 2 | required prevents blank submit; raw Better Auth error surfaced |
| 6 | Recognition Rather Than Recall | 4 | Single form, everything visible |
| 7 | Flexibility and Efficiency | 3 | autoComplete + password manager; Enter submits natively |
| 8 | Aesthetic and Minimalist Design | 4 | Card, two fields, submit, error. Nothing extra. |
| 9 | Error Recovery | 2 | Raw server error message. Form not cleared ✓ |
| 10 | Help and Documentation | 2 | No help — correct for admin-only |
| Total | | 28/40 | Acceptable |

## Anti-Patterns Verdict

Not AI slop. Centered card is correct for login. Workshop Cyan on submit + focus only. Token-clean.

## Overall Impression

Functional, clean, correct for a private admin gate. Gaps are real but low-impact — one user, rarely accessed.

## What's Working

1. Form basics correct. Labels bound, autoComplete set, required attributes, role=alert on error.
2. 44px touch targets on inputs and submit.
3. Disabled state prevents double-submit visually.

## Priority Issues

**[P2] Pending state text-only — no visual feedback on slow network**
- What: button text → "Entrando…" + disabled. No spinner, no form feedback.
- Why: VPS cold-start 2-4s. Author may re-click. Second request fires.
- Fix: animate-pulse on "Entrando…" text, or inline SVG spinner. Keep disabled.

**[P2] Raw Better Auth error message surfaced**
- What: setError(result.error.message ?? "Login failed") — technical strings possible.
- Fix: map known codes → "Incorrect email or password." at minimum.

**[P3] Mixed language: Login/Email (en) + Senha/Entrar (pt-br)**
- Cosmetic only. Admin single-user context makes it defensible.

**[P3] min-h-[60vh] tight on landscape phone — acceptable at current field count**

## Persona Red Flags

Alex (admin): 3s wait on cold VPS. Button disabled but no progress signal. Tempted to re-click.

## Minor Observations

- createClientOnlyFn SSR guard correct
- isSafeRedirect prevents open redirect — correct security
- Error callout bg-callout-error no border — matches Callout spec
