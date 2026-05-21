---
provider: manual
pr:
round: 3
round_created_at: 2026-05-21T17:47:13Z
status: resolved
file: app/components/ui/language-menu.tsx
line: 148
severity: low
author: claude-code
provider_ref:
---

# Issue 002: `LanguageDropdown` ref-forwarding uses post-commit `useEffect`

## Review Comment

`LanguageDropdown` forwards its internal `triggerRef` to the parent via a manual `useEffect` (lines 148-155):

```tsx
useEffect(() => {
  if (!ref) return;
  const node = triggerRef.current;
  if (typeof ref === "function") ref(node);
  else
    (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
}, [ref]);
```

Two problems:

1. **One-frame delay**: the effect runs *after* mount commit. Between commit and effect, `parentRef.current` is `null`. If a consumer reads the ref synchronously during the same commit (e.g., a parent `useLayoutEffect` that wants to focus the trigger on mount), they get `null`. Header's `handleDialogCancel` (`triggerRef.current?.focus()`) only runs after a user gesture so it's safe today — but the seam is brittle.

2. **No cleanup**: when the dropdown unmounts (e.g., route changes to `/admin/*` so `renderSwitcher=false` hides the menu), the parent ref still points at the now-detached `<button>` node. Subsequent `triggerRef.current?.focus()` calls become no-ops without warning. Real impact is small (dialog cancel on a hidden switcher is rare), but the pattern is wrong by construction.

Idiomatic fix — use a ref callback that merges parent ref + internal ref at the DOM node level, so both refs update in the same commit and unmount clears them:

```tsx
const setTriggerRef = React.useCallback(
  (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  },
  [ref],
);

// ...
<button ref={setTriggerRef} ... />
```

Drop the `useEffect`. The callback runs synchronously during commit, sets both refs, and React invokes it with `null` on unmount which clears the parent ref automatically.

Alternative — `useImperativeHandle` exposes a stable shape (e.g., `{ focus: () => triggerRef.current?.focus() }`) instead of leaking the raw button node. Heavier API but isolates the parent from the underlying DOM.

## Triage

- Decision: `valid`
- Notes: Bug confirmed. `useEffect` ref forwarding has one-frame delay (parent ref is null between commit and effect) and no unmount cleanup (parent ref retains detached DOM node). Fix: replace with `useCallback` ref callback that runs synchronously during commit and clears the ref on unmount. The existing `useEffect` import is kept because other effects in the component still use it.
