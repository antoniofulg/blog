---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/components/ui/dialog.tsx
line: 14
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: `DialogContent` mount-flag races Radix open lifecycle

## Review Comment

`DialogContent` gates its portal output on a per-instance mount flag (lines 14-20):

```tsx
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => {
  setMounted(true);
}, []);
if (!mounted) return null;
```

The intent (ADR-006's "SSR guard") is to suppress the portal markup on the server so the initial HTML does not flash open-modal contents before hydration. The pattern works for the closed-on-mount case, but it has two real failure modes:

1. **Open-on-mount race**: when the consumer mounts `<Dialog open={true}>` (e.g., a deep-link to a missing-twin URL that auto-opens the modal), Radix's `<Dialog.Root open>` immediately runs its own `useEffect` to manage focus, scroll lock, and Escape listeners — but `<DialogContent>` returns `null` until its own effect fires on the next paint. The user briefly sees no content while Radix has already grabbed focus and locked scroll. Visible as a one-frame flash on slow devices.

2. **Per-instance cost**: every dialog use site pays the mount-flag re-render. A future mount-many-dialogs page (admin batch confirms, share modals) burns a render per dialog instead of resolving the hydration boundary once at the module layer.

Fix — resolve the SSR boundary once, not per instance. Either:

- **A) Module-level check**: `const IS_BROWSER = typeof window !== "undefined";` and gate the portal on `IS_BROWSER`. No per-instance state; no effect; SSR output is empty by construction.
- **B) Radix-native pattern**: use `<Dialog.Portal forceMount>` plus CSS `data-state` to hide closed content. Radix's own a11y testing pattern; resolves the focus/escape race because Radix sees the actual content.

Option A is the smaller change and matches the pattern in `app/lib/locale.tsx` for client-only branches. Option B aligns with how shadcn ships Dialog upstream — preferable if shadcn-style adoption is on the roadmap.

Add a test that mounts `<MissingTwinDialog open={true}>` directly (without a click-to-open transition) and asserts the dialog content is in the DOM on first render after hydration (no null first-frame).

## Triage

- Decision: `valid`
- Notes: Per-instance `useState(false) + useEffect` costs a re-render per dialog mount and creates a one-frame window where `DialogContent` returns null while Radix has already grabbed focus/scroll-lock for `open={true}` on mount. Fix: module-level `const IS_BROWSER = typeof window !== "undefined"` (Option A from issue). Existing tests still pass because: (a) closed-dialog assertions remain null (Radix doesn't render portal content when dialog is closed), (b) trigger-click test still works. New test: `<Dialog open={true}>` on mount shows content without needing a trigger click.
