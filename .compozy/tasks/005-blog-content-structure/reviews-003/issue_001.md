---
provider: manual
pr:
round: 3
round_created_at: 2026-05-07T18:59:56Z
status: resolved
file: app/components/ui/post-card.tsx
line: 14
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: PostCard date hardcodes "pt-BR" locale regardless of lang prop

## Review Comment

`post-card.tsx` line 14 formats `post.publishedAt` with a hardcoded `"pt-BR"` locale string:

```tsx
new Date(post.publishedAt).toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
})
```

This is the same pattern fixed in `$lang/$slug.tsx` (round 1 issue 005) but `post-card.tsx` was not updated at the same time. English readers visiting `/en/blog` see Portuguese-formatted dates on every post card (e.g., `"2 de mai. de 2026"` instead of `"May 2, 2026"`).

The `lang` prop is already available in the component signature (`lang?: string`). Apply the same `dateLocale` mapping used in `$lang/$slug.tsx`:

```tsx
const dateLocale: Record<string, string> = { en: "en-US", "pt-br": "pt-BR" };

// in JSX:
{new Date(post.publishedAt).toLocaleDateString(
  dateLocale[lang ?? "pt-br"] ?? "pt-BR",
  { day: "numeric", month: "short", year: "numeric" },
)}
```

## Triage

- Decision: `valid`
- Notes: Confirmed — line 14 had `"pt-BR"` hardcoded. The `lang` prop was present but ignored for date formatting. The fix adds `const dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" }` (typed via `Locale` from `#/lib/locale`, consistent with `$lang/$slug.tsx`) and uses `dateLocale[lang ?? "pt-br"]` at line 18. Note: the prop type was simultaneously changed from `string` to `Locale` as part of issue 002's fix, so the fallback `?? "pt-BR"` is unnecessary — `lang ?? "pt-br"` is always a valid `Locale` key. Fixed in `app/components/ui/post-card.tsx`.
