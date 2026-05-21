---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/components/ui/language-menu.tsx
line: 32
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Space-key activation in menu items scrolls the page

## Review Comment

The menu item's `onKeyDown` handler triggers `onClick` for Enter and Space but never calls `preventDefault()` (lines 32-34):

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") item.onClick?.();
}}
```

Pressing Space on a `<div role="menuitem">` triggers two effects: the browser's default scroll-page-down behavior **and** the click handler. Keyboard users get an unexpected viewport shift every time they activate a locale switch via Space. Enter does not have this default, but the missing `preventDefault` is still a footgun if the menu later gets nested inside a form (Enter would submit).

Fix:

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    item.onClick?.();
  }
}}
```

Add a Vitest keyboard assertion: simulate Space on a menu item, assert that the handler fires AND that `e.defaultPrevented` is `true`.

A related improvement worth considering: switch the underlying element from `<div role="menuitem">` to `<button type="button" role="menuitem">` so the browser provides default Space/Enter activation, focus ring, and disabled semantics for free. That removes the need for the custom keyboard handler and resolves Issue 002's `aria-label` workaround too. Document the trade-off in the fix PR.

## Triage

- Decision: `valid`
- Notes: `onKeyDown` calls `item.onClick?.()` for Space without `e.preventDefault()`. Browser default for Space on a non-button element is scroll-page-down, so keyboard users get an unexpected viewport shift on every locale switch. Enter has no scroll default but missing preventDefault is still a footgun. Fix: add `e.preventDefault()` before the handler call. Add test in the new `app/tests/language-menu.test.ts`.
