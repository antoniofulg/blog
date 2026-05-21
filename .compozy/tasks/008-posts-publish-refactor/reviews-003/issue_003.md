---
provider: manual
pr:
round: 3
round_created_at: 2026-05-21T17:47:13Z
status: resolved
file: app/routes/{-$locale}/$slug.tsx
line: 234
severity: low
author: claude-code
provider_ref:
---

# Issue 003: `StaticPageView` lacks a back-nav footer (UX inconsistency vs `PostView`)

## Review Comment

`PostView` ends with `<PostFooter />` (line 218) that renders a "← Writing / Escrita" link back to the homepage and the publication date. `StaticPageView` (lines 234-261) has no footer at all — once the reader scrolls to the end of an `/about` page they have no in-content way back to the listing besides the global header.

The two views share everything else (page padding, prose chrome, `animate-fade-up`, hr divider, `aria-labelledby`), so the missing footer reads as an oversight from the hand-merge, not a deliberate design call. ADR-001 frames pages as a first-class content type; UX continuity with posts is the natural expectation.

Fix — render a slimmed footer on static pages. Static pages don't have `publishedAt`, so the "Published on" date row from `PostFooter` doesn't apply. Either:

1. **Extract a smaller `BackToHomeLink` component** consumed by both `PostFooter` (after the date line) and `StaticPageView` (as the entire footer). Keeps the visual primitive in one place.

2. **Inline the back link in `StaticPageView`**:

   ```tsx
   <footer className="mt-16 flex flex-col gap-6 border-t border-border pt-10">
     <Link
       to="/{-$locale}/"
       params={{ locale: requestedLang === DEFAULT_LOCALE ? undefined : requestedLang }}
       className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground"
     >
       <ArrowLeft className="h-4 w-4" aria-hidden="true" />
       <span>{requestedLang === "en" ? "Writing" : "Escrita"}</span>
     </Link>
   </footer>
   ```

Option 1 is cleaner long-term; Option 2 is the smaller diff if you want to ship it inside this PR.

## Triage

- Decision: `valid`
- Notes: Confirmed missing footer in `StaticPageView`. `PostView` renders `<PostFooter />` with back-nav; `StaticPageView` has no footer at all. Fix: reuse `PostFooter` with `publishedAt={null}` — the component guards the date row behind `{formattedDate && ...}` so only the back link renders. This avoids new imports and keeps styling consistent. `postLang` is set to `data.requestedLang` since there is no post-specific lang on a static page and `postLang` is only used for date formatting (which won't render here).
