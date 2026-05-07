---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T01:24:57Z
status: resolved
file: vite.config.ts
line: 13
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: `#/lib/session` missing from SERVER_ONLY_IDS stub list

## Review Comment

`vite.config.ts` defines a `SERVER_ONLY_IDS` set that stubs server-only modules when they appear in client bundles. The new `app/lib/session.ts` is not in this set, even though it imports `@tanstack/react-start/server` (`getRequest`) and `#/lib/auth` — both of which require a server request context and a running auth instance.

Currently, `session.ts` is only imported by `admin/index.server.ts` and `admin/preview.$slug.server.ts`, which TanStack Start's build system handles as server-only. So there is no immediate production breakage. However, the lack of a stub entry is inconsistent with how other server-only lib files are treated (`#/lib/auth` is stubbed, `#/lib/watcher.server` is stubbed). If any future code accidentally imports `#/lib/session` from a non-server context, Vite would include the real module in the client bundle, and `getRequest()` would throw at runtime because there is no request context in a browser.

**Fix:** Add `"#/lib/session"` to the `SERVER_ONLY_IDS` set and add `requireSession: null` to the stub export string for completeness:

```typescript
const SERVER_ONLY_IDS = new Set([
  "#/db/client",
  "#/db/indexer",
  "#/lib/mdx/parser.server",
  "#/lib/mdx/renderer.server",
  "#/lib/watcher.server",
  "#/lib/auth",
  "#/lib/session",   // ← add this
]);
```

And in the stub export string:
```
"export const ..., requireSession=()=>Promise.resolve();"
```

## Triage

- Decision: `valid`
- Notes: `session.ts` imports `getRequest` from `@tanstack/react-start/server` and `auth` from `#/lib/auth` — both require server context. `#/lib/auth` is already in `SERVER_ONLY_IDS`. Omitting `#/lib/session` is inconsistent and creates a footgun: any accidental client import would bundle the real module and throw `getRequest()` at runtime in the browser. Fix: add `"#/lib/session"` to `SERVER_ONLY_IDS` and add `requireSession=()=>Promise.resolve()` to the stub export string.
