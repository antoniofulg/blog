---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/routes/sitemap[.]xml.server.ts
line: 52
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Sitemap falls back to `http://localhost:3000` when SITE_URL unset

## Review Comment

`getSiteOrigin()` returns `process.env.SITE_URL ?? "http://localhost:3000"` (line 52). If `SITE_URL` is missing in a production deploy — first deploy, forgotten env, secret-rotation slip — the rendered `sitemap.xml` ships `<loc>http://localhost:3000/...</loc>` and matching `<xhtml:link href="http://localhost:3000/...">` annotations to Googlebot.

Failure mode is silent and durable: the response is HTTP 200, the XML parses, and Google caches the localhost URLs. By the time anyone notices, a partial crawl of the bilingual sitemap has poisoned the index with unreachable URLs.

Fix — fail loudly when `SITE_URL` is required:

```ts
function getSiteOrigin(): string {
  const url = process.env.SITE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SITE_URL must be set in production (sitemap origin)");
    }
    return "http://localhost:3000";
  }
  return url.replace(/\/$/, "");
}
```

If a thrown error reaches the route handler, return a 500 with a brief message — that surfaces the misconfiguration in CD logs immediately instead of letting localhost URLs leak.

Also add an integration test that asserts `getSiteOrigin()` throws when `NODE_ENV=production` and `SITE_URL` is missing (mock `process.env` per the existing Vitest patterns in this repo).

## Triage

- Decision: `valid`
- Notes: `getSiteOrigin()` uses `??` which only catches null/undefined; an unset `SITE_URL` env var IS undefined, so the fallback fires. In production this silently ships `<loc>http://localhost:3000/...</loc>` — HTTP 200 response, parseable XML, but poisoned index that takes weeks to recover. Fix: throw in production, return localhost otherwise. Also wrap `getSitemapXmlResponse` in try/catch to surface 500 in CD logs immediately. Existing "falls back to localhost" test uses `vi.stubEnv("SITE_URL", "")` — new `!url` check catches empty string too; the test only asserts `entries.length > 0` so it passes. Add new test for production throw.
