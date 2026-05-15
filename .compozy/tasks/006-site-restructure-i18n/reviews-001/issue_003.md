---
provider: manual
pr:
round: 1
round_created_at: 2026-05-15T13:01:46Z
status: resolved
file: vite.config.ts
line: 84
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: vite.config.ts importProtection.excludeFiles missing about.server.ts

## Review Comment

The `tanstackStart` plugin in `vite.config.ts:80-92` configures `importProtection.client.excludeFiles` to allow specific server-fn modules to be imported from client route files:

```
excludeFiles: [
  "app/routes/{-$locale}/$slug.server.ts",
  "app/routes/{-$locale}/index.server.ts",
  "app/routes/admin/index.server.ts",
  "app/routes/admin/preview.$slug.server.ts",
],
```

When task_06 renamed the route subtree and task_13 added the new About route, the list was updated for the renamed `$slug.server.ts` and `index.server.ts` but **not** for the newly-created `app/routes/{-$locale}/about.server.ts`.

The About route at `app/routes/{-$locale}/about.tsx:10` imports from `./about.server`:

```
import { loadAboutFn } from "./about.server";
```

Without the exclusion, the TanStack Start import-protection plugin will treat the route's client-bundle traversal as a violation when it sees a `.server.ts` import from a route component, and the build will fail (or, depending on plugin policy, emit a runtime stub that breaks the `loadAboutFn` server-fn call).

The pattern across the existing entries is clear: every server-fn module co-located with a route under `app/routes/{-$locale}/` and `app/routes/admin/` is listed. About is the outlier.

**Suggested fix**: add the missing entry, keeping the file order consistent with route layout:

```
excludeFiles: [
  "app/routes/{-$locale}/$slug.server.ts",
  "app/routes/{-$locale}/about.server.ts",
  "app/routes/{-$locale}/index.server.ts",
  "app/routes/admin/index.server.ts",
  "app/routes/admin/preview.$slug.server.ts",
],
```

Verify by running `make check` and a fresh `bun run build` (or `make build` if defined). If the build succeeds today, it is likely because the import-protection plugin emits a warning rather than an error, but the warning should not be ignored — the next dev who copies the pattern for a new route will assume omission is OK, and a future strict-mode upgrade of the plugin will break the build.

## Triage

- Decision: `valid`
- Notes: Confirmed `app/routes/{-$locale}/about.server.ts` exists. Confirmed `vite.config.ts:84-89` `excludeFiles` lists 4 entries and is missing `"app/routes/{-$locale}/about.server.ts"`. The about route imports `loadAboutFn` from `./about.server`; without the exclusion the import-protection plugin treats this as a violation. Fix: insert the missing entry between `$slug.server.ts` and `index.server.ts` to maintain alphabetical order within the locale subdirectory.
