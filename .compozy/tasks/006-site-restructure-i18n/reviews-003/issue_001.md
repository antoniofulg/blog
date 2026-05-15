---
provider: manual
pr:
round: 3
round_created_at: 2026-05-15T13:24:44Z
status: resolved
file: app/lib/locale.tsx
line: 65
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: detectLocaleFromRequest ignores Accept-Language quality weights

## Review Comment

`app/lib/locale.tsx:58-66` implements:

```
export function detectLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]+)/);
  const stored = match?.[1]?.trim() as Locale | undefined;
  if (stored && LOCALES.includes(stored)) return stored;

  const acceptLang = request.headers.get("Accept-Language") ?? "";
  return /\bpt\b/i.test(acceptLang) ? "pt-br" : DEFAULT_LOCALE;
}
```

The Accept-Language fallback uses a substring regex that returns `"pt-br"` whenever `pt` appears anywhere in the header, regardless of the q-weight (quality) attached to it. Per RFC 9110 §12.5.4, Accept-Language entries carry priority via `q=...` values and clients expect the highest-weight matching language to win.

Concrete failure cases:

1. `Accept-Language: en-US,en;q=0.9,pt;q=0.1` — user clearly prefers English (`en;q=0.9` > `pt;q=0.1`). Current code redirects to `/pt-br/`. User has to manually switch back.
2. `Accept-Language: en;q=1.0,pt;q=0.0` — user explicitly declines Portuguese (`q=0.0` means "not acceptable" per the spec). Current code still redirects to `/pt-br/`. Direct contradiction of user preference.
3. `Accept-Language: zh-CN,zh;q=0.9,en-US;q=0.8,pt-BR;q=0.1` — user wants Chinese, then English, then Portuguese as last resort. Current code redirects to `/pt-br/`. Wrong outcome.

The cookie-precedent rule (ADR-005) means this only affects first-time visitors with no `locale` cookie set, but those are exactly the visitors the auto-redirect feature targets. The downstream SEO consequence is also real: search engines like Googlebot can be configured with Accept-Language for international crawls; under the current regex, any header containing `pt` redirects the crawler to `/pt-br/`, which fragments crawl results.

The cookie-precedent test in `app/tests/locale.test.ts:85-97` shows the cookie path is correct. The Accept-Language path is the weak spot; no q-weight test exists.

**Suggested fix**: parse Accept-Language into ordered preference pairs. Stdlib-free implementation:

```
function preferredLocale(acceptLang: string): Locale {
  const entries = acceptLang
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), weight: Number.isFinite(weight) ? weight : 1 };
    })
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of entries) {
    if (tag.startsWith("pt")) return "pt-br";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
```

Then `detectLocaleFromRequest` calls `preferredLocale(acceptLang)`. Add unit tests for the three failure cases above plus the existing positive cases. Consider also whether `pt-PT` (European Portuguese) should redirect to `pt-br` at all — current behavior maps any `pt*` to Brazilian Portuguese, which is the only Portuguese variant in `LOCALES`. Acceptable for V1; document the choice.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed — `detectLocaleFromRequest` uses `/\bpt\b/i.test(acceptLang)` which
  matches `pt` anywhere in the string regardless of q-values. A header like
  `en-US,en;q=0.9,pt;q=0.1` (user prefers English) incorrectly returns `pt-br`.
  Fix: extract `preferredLocale(acceptLang)` helper that parses the header into
  `{ tag, weight }` pairs, filters out q=0 entries, sorts descending by weight, then
  walks the sorted list matching the first `pt*` → `"pt-br"` or `en*` → `"en"`.
  Add three unit tests covering the three failure cases described in the issue.
