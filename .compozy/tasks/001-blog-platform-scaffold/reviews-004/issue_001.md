---
provider: manual
pr:
round: 4
round_created_at: 2026-05-05T17:32:49Z
status: resolved
file: app/tests/public-routes.test.ts
line: 259
severity: high
author: claude-code
provider_ref:
---

# Issue 001: View counter integration test invalid after useEffect migration

## Review Comment

Round 1 issue_007 moved `incrementViewCount` from the route `loader` (server-side) to `useEffect` in `PostDetail` (client-side). The intent was to prevent the view counter from firing during TanStack Router's hover-prefetch. However, the integration test for the view counter was not updated to reflect this change:

```typescript
it("GET /:slug twice increments view_count by 2", async () => {
    await fetch(`${BASE_URL}/${SLUG}`);
    await fetch(`${BASE_URL}/${SLUG}`);
    await new Promise((r) => setTimeout(r, 300));
    const rows = await sql<{ view_count: number }[]>`
        SELECT view_count FROM posts WHERE slug = ${SLUG}
    `;
    expect(rows[0].view_count).toBeGreaterThanOrEqual(2);
});
```

`fetch()` in Node.js retrieves the SSR-rendered HTML from the server. React's `useEffect` only runs after the browser receives the HTML and React hydrates — a bare `fetch()` call never triggers hydration. As a result, `incrementViewCount` is never called, `view_count` remains 0, and the assertion `toBeGreaterThanOrEqual(2)` fails.

The `skipIf(port5432Free || port3000Free)` guard means this test is skipped whenever the dev server isn't already running (i.e., in all normal CI and `make test` runs). The failure is invisible until someone runs the full integration suite against a live server — at which point it fails silently as a view-counter regression.

PRD F7 ("per-post view counts shown in admin") has no valid automated test coverage after the migration.

**Fix options:**

1. **Remove the broken test** and add a component-level unit test that verifies `useEffect` calls `incrementViewCount` via React Testing Library:
   ```typescript
   import { render, waitFor } from "@testing-library/react";
   import { PostDetail } from "#/routes/$slug";

   it("calls incrementViewCount via useEffect after mount", async () => {
       const mockIncrement = vi.fn();
       // mock the server fn and render PostDetail with a post fixture
       render(<PostDetail />, { /* ... */ });
       await waitFor(() => expect(mockIncrement).toHaveBeenCalledWith(1));
   });
   ```

2. **Replace the fetch-based test** with a direct DB + function call test that verifies `incrementViewCountFn` correctly updates the row (this already exists as a unit test — so the integration test may simply be redundant and can be removed).

3. **Instrument the dev server** to expose a test-only endpoint that fires the view count increment server-side, then fetch that endpoint instead. This is the most faithful integration test but adds test scaffolding.

Option 2 is the simplest: the unit test for `incrementViewCountFn` (lines 182–201) already confirms the SQL update is correctly formed. The integration test adds little signal and should be removed or replaced by an RTL component test.

## Triage

- Decision: `valid`
- Notes: Confirmed. `incrementViewCount` is called inside `useEffect` in the `PostDetail` component (`app/routes/$slug.tsx` lines 79-80), not in the loader. Node.js `fetch()` retrieves SSR HTML only — `useEffect` never runs without browser hydration. The test at line 259 will always observe `view_count = 0`, making `toBeGreaterThanOrEqual(2)` fail. The unit test suite at lines 182-201 already verifies `incrementViewCountFn` SQL correctness, so the broken integration test is redundant. Fix: remove the broken integration test (Option 2 from the review comment).
