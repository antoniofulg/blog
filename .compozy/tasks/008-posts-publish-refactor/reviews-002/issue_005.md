---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/lib/content-audit/checks.server.ts
line: 234
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: `checkPageTranslationGaps` only audits EN → PT-BR direction

## Review Comment

`checkPageTranslationGaps` (lines 234-252) walks `enPages` and flags those missing a `pt-br` twin, but never iterates `ptBrPages` to flag pt-br pages missing an `en` twin:

```ts
const enPages = pagesByLocale["en"] ?? [];
const ptBrSlugs = new Set((pagesByLocale["pt-br"] ?? []).map((p) => p.slug));

for (const page of enPages) {
  if (!ptBrSlugs.has(page.slug)) {
    findings.push({ category: "translation-gap", severity: "major", ... });
  }
}
```

A pt-br-only page (`app/content/pages/pt-br/uses.mdx` with no en twin) silently escapes the audit. The post-side helper (`checkTranslationGaps`, lines 113-127) loops every post and consults `post.hasTwin`, so it catches both directions; pages are asymmetric.

Fix — mirror both directions, or refactor to a single helper that takes both locale lists and reports gaps in either direction:

```ts
export function checkPageTranslationGaps(
  pagesByLocale: Partial<Record<Locale, PageEntry[]>>,
): Finding[] {
  const findings: Finding[] = [];
  const slugsByLocale = Object.fromEntries(
    LOCALES.map((l) => [l, new Set((pagesByLocale[l] ?? []).map((p) => p.slug))]),
  ) as Record<Locale, Set<string>>;

  for (const locale of LOCALES) {
    const otherLocale = LOCALES.find((l) => l !== locale)!;
    for (const page of pagesByLocale[locale] ?? []) {
      if (!slugsByLocale[otherLocale].has(page.slug)) {
        findings.push({
          category: "translation-gap",
          severity: "major",
          filePath: page.filePath,
          message: `Page "${page.slug}" (${locale}) has no translation twin. Add the translation at app/content/pages/${otherLocale}/${page.slug}.mdx.`,
        });
      }
    }
  }
  return findings;
}
```

Add a Vitest fixture with a pt-br-only page and assert the finding fires.

## Triage

- Decision: `valid`
- Notes: `checkPageTranslationGaps` only iterates `enPages` and checks against `ptBrSlugs`. A PT-BR-only page (no EN twin) never emits a finding. The post-side helper `checkTranslationGaps` uses `post.hasTwin` which covers both directions; pages are asymmetric. Fix: replace with bidirectional loop using `LOCALES.find(l => l !== locale)` pattern. Existing tests only cover EN→PT-BR direction — add PT-BR→EN test. Existing tests still pass because bidirectional check preserves EN→PT-BR behavior.
