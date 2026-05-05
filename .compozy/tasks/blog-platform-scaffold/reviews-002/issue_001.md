---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: pending
file: app/routes/__root.tsx
line: 115
severity: high
author: claude-code
provider_ref:
---

# Issue 001: TanStack devtools shipped to production without dev-only guard

## Review Comment

`TanStackDevtools` and `TanStackRouterDevtoolsPanel` are imported at the top of `__root.tsx` and rendered unconditionally inside `RootDocument`:

```tsx
<TanStackDevtools
  config={{ position: "bottom-right" }}
  plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
/>
```

There is no `import.meta.env.DEV` guard. In a production build the devtools package (and all its dependencies) are included in the client bundle and the panel is mounted in the DOM for every visitor. This adds significant bundle weight and exposes internal router state to end users.

Because this is a scaffold, the pattern propagates to every project cloned from it.

**Fix**: Wrap the devtools in a development-only conditional:

```tsx
{import.meta.env.DEV && (
  <TanStackDevtools
    config={{ position: "bottom-right" }}
    plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
  />
)}
```

Vite tree-shakes this branch in production builds, eliminating the devtools from the bundle entirely.

## Triage

- Decision: `UNREVIEWED`
- Notes:
