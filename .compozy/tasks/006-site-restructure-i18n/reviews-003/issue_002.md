---
provider: manual
pr:
round: 3
round_created_at: 2026-05-15T13:24:44Z
status: resolved
file: app/routes/{-$locale}/index.tsx
line: 43
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Vary header may not propagate to the 302 redirect response

## Review Comment

`app/routes/{-$locale}/index.tsx:36-48` implements the cookie-first SSR redirect:

```
beforeLoad: async ({ params }) => {
  if (params.locale !== undefined) return;
  if (!import.meta.env.SSR) return;
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  const req = getRequest();
  setResponseHeader("Vary", "Cookie, Accept-Language");
  const detected = detectLocaleFromRequest(req);
  if (detected !== DEFAULT_LOCALE) {
    throw redirect({ href: `/${detected}/`, statusCode: 302 });
  }
},
```

`setResponseHeader` mutates the in-flight 200 OK response that TanStack Start has prepared for this route. When the next line throws a `redirect(...)`, TanStack Router replaces the in-flight response with a new 302 Response constructed from the redirect options. The Vary header set on the original response object does **not** automatically transfer to the redirect Response — `redirect()` exposes its own `headers` field for that purpose (see `node_modules/@tanstack/router-core/dist/esm/redirect.d.ts:24-29`).

Consequence: when the redirect fires, the 302 response sent to the browser likely carries **no Vary header**. A CDN sitting in front of the site (Cloudflare, Fastly, Vercel edge, etc.) caches the 302 keyed by URL alone. The first visitor whose `detectLocaleFromRequest` returns `pt-br` triggers the cache to store `GET / → 302 Location: /pt-br/` for all subsequent visitors — including English-only visitors and search engine bots — until cache TTL expires.

Existing test coverage at `app/tests/ssr-redirect.test.ts:54-64` asserts Vary on the 200 response only:

```
it("/ response includes Vary: Cookie, Accept-Language", async () => {
  const res = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  // no Cookie, no Accept-Language → 200 path
  ...
});
```

It does **not** test that the 302 response also includes Vary. The bug would not show up in the test suite even if the 302 lacks Vary.

ADR-005 "Implementation Notes" explicitly states: "Response headers must include `Vary: Cookie, Accept-Language` on `/` **regardless of whether a redirect occurs**." The current implementation only partially honors this — the 200 path is covered, the 302 path is not.

**Suggested fix**: attach the Vary header to the redirect itself so both response paths carry it:

```
if (detected !== DEFAULT_LOCALE) {
  throw redirect({
    href: `/${detected}/`,
    statusCode: 302,
    headers: { Vary: "Cookie, Accept-Language" },
  });
}
```

Keep the `setResponseHeader` call for the 200 path (it still applies when no redirect fires). Add an integration test in `ssr-redirect.test.ts` mirroring the existing Vary test but with `Cookie: locale=pt-br` so the redirect path is exercised, asserting both `status === 302` and `headers.get("vary").includes("Cookie")`.

Until the test runs against a live server (skipped when port 3000 is free per the `describe.skipIf` guard), the regression is invisible to CI. Consider adding a unit-level assertion on the `redirect()` call options if a mocking strategy is available.

## Triage

- Decision: `valid`
- Notes: Confirmed. `setResponseHeader("Vary", ...)` mutates the in-flight 200 Response.
  When `throw redirect(...)` fires, TanStack Router constructs a fresh 302 Response
  from the redirect options — the Vary header set on the original Response is not
  transferred. Fix: pass `headers: { Vary: "Cookie, Accept-Language" }` directly
  in the `redirect()` options. Keep the `setResponseHeader` call for the 200 path.
  Also implements issue 003 fix simultaneously (same call site). Add integration
  test to ssr-redirect.test.ts asserting Vary on the 302 response.
