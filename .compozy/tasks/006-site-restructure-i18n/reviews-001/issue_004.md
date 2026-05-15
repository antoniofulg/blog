---
provider: manual
pr:
round: 1
round_created_at: 2026-05-15T13:01:46Z
status: resolved
file: app/components/layout/footer.tsx
line: 25
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Footer social links still point at generic site roots

## Review Comment

The PRD's stated problem ("first, mocked data is everywhere a visitor looks") explicitly calls out the About page's social icons whose hrefs are `https://github.com`, `https://linkedin.com`, `https://twitter.com` — generic site roots, not real profiles. Task_13 migrated About to MDX-per-locale, which gives the author full control over the About page's contact links via the typed `links[]` frontmatter, and the new About route renders those correctly.

However, the **footer's social icons** (`app/components/layout/footer.tsx:23-48`) still hardcode the same placeholder URLs:

```
<a href="https://github.com" ...>          // line 25
<a href="https://linkedin.com" ...>        // line 33
<a href="https://twitter.com" ...>         // line 41
```

These render on every page rather than only on About, so the credibility problem PRD F1 was supposed to eliminate ("0 mock-data matches in `app/routes/` and `app/components/`") persists. A `grep` for `https://github.com\|https://linkedin.com\|https://twitter.com` in `app/components/` returns three hits, all in `footer.tsx`. The PRD goal "Mocked data instances in `app/routes/` and `app/components/`: 0 (from ~10+)" is not actually met until these are addressed.

ADR-001 deferred full footer i18n string extraction to V2, but the **link `href` values** are not i18n strings — they are data the author either has or does not. They are exactly the kind of mocked data the PRD intends to eliminate in V1.

**Suggested fix** (any of three approaches):

1. **Replace with real URLs**: simplest. Edit footer.tsx to use the author's actual profiles (e.g., `https://github.com/antoniofulg`, etc.). This violates the spirit of ADR-001 (footer should not hardcode user-facing content) but matches V1 scope of "no mocked data".
2. **Remove the social block from the footer**: the About page already exposes contact links via the MDX `links[]` array. Duplicating them in the footer adds maintenance surface for no clear UX win. Remove the three `<a>` tags.
3. **Drive the footer socials from the same data source as About**: either import the en About `links[]` at build time or expose a small `app/lib/contact.ts` constant. Cleanest but slightly more code than V1 needs.

Recommendation: option 2 (remove). The footer already has a "Sobre" link in `resourceLinks`; routing visitors to About for contact info is the right canonical path and aligns with the indie-dev minimal pattern PRD adopts for the About page.

## Triage

- Decision: `valid`
- Notes: Confirmed `footer.tsx:25,33,41` hardcode `https://github.com`, `https://linkedin.com`, `https://twitter.com`. These are placeholder URLs appearing on every page. ADR-001 defers footer i18n to V2 but the PRD explicitly targets zero mock-data in `app/components/`. Chosen fix: option 2 (remove the social block) — the About page already surfaces real profile links via the `links[]` frontmatter; duplicating them in the footer adds maintenance overhead. The `Github`, `Linkedin`, `Twitter` imports from lucide-react will also be removed. The footer Blog nav link (`navLinks:1`) will be fixed here too (remove "Blog" entry — same root cause as issue_002).
