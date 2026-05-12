---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/routes/$lang/$slug.tsx
line: 95
severity: high
author: claude-code
provider_ref:
---

# Issue 001: hreflang meta tags (F7) not implemented on post detail pages

## Review Comment

PRD F7 requires `hreflang` meta tags on every post detail page linking the English and Portuguese versions when both exist in the DB. The `head()` function in `$lang/$slug.tsx` only sets `title`, `description`, `og:title`, and `og:description` — no `hreflang` tags are generated.

Without `hreflang`, search engines cannot associate the two language versions of a post. Google may index both URLs as duplicates instead of alternates, splitting ranking signals and serving the wrong language to users.

To fix, the loader needs to query for the alternate-locale version of the same slug and return its existence. The `head()` function can then emit the tags when both versions exist:

```typescript
// In PostLoaderResult (type), add:
alternateLang: Locale | null;

// In loader (getPostBySlugWithLangFn), after resolving the post:
const [altPost] = await db.select()
  .from(posts)
  .where(and(eq(posts.slug, slug), not(eq(posts.lang, resolvedLang)), eq(posts.isPublished, true)));
// return { ..., alternateLang: altPost?.lang ?? null }

// In head():
...(loaderData?.alternateLang ? [
  { tagName: "link", rel: "alternate", hrefLang: loaderData.post.lang, href: `/${loaderData.post.lang}/${loaderData.post.slug}` },
  { tagName: "link", rel: "alternate", hrefLang: loaderData.alternateLang, href: `/${loaderData.alternateLang}/${loaderData.post.slug}` },
] : [])
```

## Triage

- Decision: `valid`
- Notes: Confirmed — `head()` in `$lang/$slug.tsx` returns only `meta` with title, description, og tags. No `links` array at all. Without hreflang, Google treats `/en/slug` and `/pt-br/slug` as duplicates. Fix: add `alternateLang: Locale | null` to `PostLoaderResult`, query for the other-locale version in the `exactPost` branch of `getPostBySlugWithLangFn`, and return hreflang `links` from `head()` when `alternateLang` is set. Implemented inside the server-file extraction (issue 003).
