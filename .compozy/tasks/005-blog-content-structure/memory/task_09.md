# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Add language switcher to `app/components/layout/header.tsx`. Button reads locale via `useLocale()`, calls `setLocale()`, and navigates to locale-prefixed URL.

**Status: complete**

## Important Decisions

- Extracted `useLangSwitcher()` hook inside `header.tsx` — used by both `Header` and `MobileMenu` components; avoids prop-drilling without adding a new file
- Used `useRouterState({ select: (s) => s.location.pathname })` to get current pathname (no extra imports beyond what TanStack Router already provides)
- Navigation uses typed TanStack Router `navigate({ to: "/$lang/blog", params })` and `navigate({ to: "/$lang/$slug", params })` — type-safe
- Test file is `.test.ts` (not `.tsx`) per vitest config include pattern `*.test.ts`

## Learnings

- `@testing-library/react` auto-cleanup does not fire between tests in this setup — must call `cleanup()` explicitly in each `afterEach`
- `window.matchMedia` must be stubbed in jsdom tests that render `ThemeProvider`
- biome formats multi-arg navigate calls as multi-line if line is long — auto-fixable with `bunx biome check --write`
- Hoisting a `let currentPathname` variable inside `vi.hoisted()` allows per-test pathname control without re-mocking the module

## Files / Surfaces

- Modified: `app/components/layout/header.tsx`
- Created: `app/tests/header.test.ts`

## Errors / Corrections

- First test run had 6/7 failures: "Found multiple elements with role button/Switch language" — root cause was missing `cleanup()` between tests; fixed by adding explicit `afterEach(() => { cleanup(); })`

## Ready for Next Run

task_09 complete. task_10 and task_03 remain.
