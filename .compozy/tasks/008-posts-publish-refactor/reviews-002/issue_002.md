---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/components/ui/language-menu.tsx
line: 38
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: "(not available)" hint is hidden from screen readers

## Review Comment

The language-menu item renders the unavailability hint as a sibling `<span>` with `aria-hidden="true"` (line 38):

```tsx
<span>{item.label}</span>
{!isAvailable && <span aria-hidden="true">{hint}</span>}
```

A screen-reader user navigating the menu hears the locale label and the `aria-disabled` state, but never hears *why* the option is unavailable — the explanatory hint that sighted users see is announced to no one. ADR-003 sets the per-item availability hint as a first-class UX affordance; for screen-reader users it disappears entirely.

Fix — fold the hint into the menu item's accessible name and drop the redundant aria-hidden node:

```tsx
const label = !isAvailable ? `${item.label} ${hint}` : item.label;
<div
  ...
  aria-label={label}
  aria-disabled={!isAvailable ? "true" : undefined}
>
  <span>{item.label}</span>
  {!isAvailable && <span aria-hidden="true">{hint}</span>}
</div>
```

The visible markup stays the same (sighted users see the hint as before); the explicit `aria-label` ensures the assistive-tech announcement includes "(not available)" alongside the locale label. Add a unit assertion that the rendered `aria-label` matches the visible composite when `available={false}`.

## Triage

- Decision: `valid`
- Notes: The hint span has `aria-hidden="true"`, so NVDA/VoiceOver announce only the locale label and aria-disabled state — the "why" is invisible to AT users. ADR-003 treats the availability hint as a first-class affordance. Fix: add `aria-label` on the wrapper div that folds in the hint text when `!isAvailable`; the visible DOM stays unchanged (sighted users see the hint as before). No existing test file for LanguageMenu — create `app/tests/language-menu.test.ts`.
