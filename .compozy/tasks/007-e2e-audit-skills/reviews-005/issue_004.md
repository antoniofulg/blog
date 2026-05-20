---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: resolved
file: app/lib/app-audit/browser-sweep.server.ts
line: 144
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: broken-image check races lazy-loaded and JS-injected images

## Review Comment

`app/lib/app-audit/browser-sweep.server.ts:104` awaits `page.goto(route.path, { waitUntil: "load" })`, then `:144-150` runs:

```ts
const brokenImages = await page
  .locator("img")
  .evaluateAll((imgs) =>
    (imgs as HTMLImageElement[])
      .filter((img) => img.naturalWidth === 0)
      .map((img) => img.src),
  );
```

`waitUntil: "load"` fires when the document and its initial subresources finish loading. It does NOT wait for:

1. **Lazy-loaded images** (`loading="lazy"`) that defer loading until the viewport intersects them — they remain with `naturalWidth === 0` until scrolled into view.
2. **JS-injected images** (e.g., loaded by React components after hydration, dynamic `<img src>` injection in `useEffect`, intersection-observer triggered loads) — these may be in the DOM but not yet network-loaded at the `load` event.
3. **Images behind `srcset`/`<picture>`** — `naturalWidth === 0` until the browser selects a candidate and loads it.

False positives: every lazy/dynamic image below the fold gets flagged as `broken-image` with `severity: "major"`. On a content blog with MDX posts using `loading="lazy"`, every fresh audit run could produce dozens of false-positive findings — the exact PR-comment-fatigue scenario that ADR-005 + ADR-006 designed against.

False negative inverse: actual broken images that DO load (network 404 with a placeholder rendered) might escape detection.

**Suggested fix:** combine three improvements:

1. Replace `waitUntil: "load"` with `waitUntil: "networkidle"` (slower but accurate after async loads settle). Acceptable cost: ~500ms-2s per route.
2. Add `img.complete && img.naturalWidth === 0` (only checks loaded images — skips lazy ones that haven't fetched yet).
3. Optionally scroll the page to viewport-bottom before the check to trigger intersection-observer lazy loads (`await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))`).

Document the change in `.agents/rules/fe-audit.md` so future authors understand the lazy-image semantics. Add a Vitest test with a fixture page using `<img loading="lazy" src="...">` and assert no false positive.

## Triage

- Decision: `valid`
- Notes: Confirmed. `browser-sweep.server.ts:104` uses `waitUntil: "load"` which fires before lazy/JS-injected images load. `:144-150` checks `img.naturalWidth === 0` without `img.complete`, flagging lazy images that haven't been fetched yet as broken. Two fixes needed: change wait strategy to `networkidle` and add `img.complete &&` guard. Note: skip the scroll-to-bottom suggestion — `networkidle` already covers this and the added complexity is not warranted.
