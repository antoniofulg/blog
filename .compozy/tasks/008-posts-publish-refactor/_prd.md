# PRD — Posts Publish Refactor

## Overview

The blog ships with three vestigial constraints that fight a solo author and confuse bilingual readers: a `published` boolean column that no frontmatter ever writes to, a `/about` page that lives outside the content convention used by every other route, and a language switcher that silently dumps readers on the locale homepage whenever the target translation does not exist. This refactor removes all three: file presence becomes the only post-visibility signal, static pages get a first-class directory convention with shared access through a single module, and the language switcher tells the reader *before* they click which locales are available — falling back to a confirm modal on the missing-twin path that redirects to the locale homepage only after explicit acceptance.

The target users are the solo technical author (writes MDX in their editor, ships via `git commit && git push`) and the bilingual reader (lands on a post, expects the switcher to land on the same post in the other language or to be told why it cannot). The value is correctness: the author stops fighting an invisible toggle they invented; the reader stops being silently redirected; new static pages stop requiring a per-page loader file. The refactor also lays the foundation for honest SEO by emitting `sitemap.xml` with hreflang pairs only where twins genuinely exist.

## Goals

- Reduce the path from "post written" to "post live" to a single `git push` — no admin toggle, no flag flip, no post-merge step.
- Eliminate the language-switcher home-redirect bug for any route that has a target-locale twin available.
- Make adding a static page (e.g., `/uses`, `/now`) a content-only change — drop the `.mdx` file under `app/content/pages/<locale>/`, no route or loader edits.
- Emit `sitemap.xml` with reciprocated hreflang pairs only when a twin exists, eliminating asymmetric-hreflang violations entirely.
- Trim the admin surface to a list + locale filter; remove all write affordances (toggle, edit, new, preview).
- Land the entire refactor as a single release so the author lives with one before/after, not three intermediate states.

Target timeline: one PR merged to `main`, deployed via the standard CD pipeline. No multi-phase release.

## User Stories

### P1 — Author (solo, technical)

- As the author, I want to publish a post by committing a new `.mdx` file and pushing, so that there is no toggle between writing and shipping.
- As the author, I want to unpublish a post by deleting the file, so that removal is symmetric with publication.
- As the author, I want to add a new static page (e.g., `/uses`) by creating `app/content/pages/<locale>/uses.mdx`, so that I do not edit route files or loader code.
- As the author, I want the `/admin` index to list every post with a filter for English / Portuguese / both, so that I can quickly find posts missing a translation while keeping the surface minimal.
- As the author, I want to click "View" next to any post in `/admin` and open the public URL in a new tab, so that I can verify the rendered output without an embedded preview.

### P2 — Bilingual reader

- As a reader on an English post, I want the language menu to show "Português (BR)" with an inline "(not available)" hint when no translation exists, so that I know what to expect before clicking.
- As a reader, I want clicking the available language to take me directly to the twin in that language, so that I read what I came for.
- As a reader, I want clicking an unavailable language to ask me to confirm before redirecting me, so that I am not silently moved away from the content I was reading.
- As a reader, I want the confirm modal to speak the language I am currently reading in, so that I can understand what I am consenting to.

### P3 — Search engine crawler (secondary)

- As a search engine, I want `sitemap.xml` to list every published post and static page, with hreflang annotations for both directions only when both translations exist, so that I can index the bilingual content without ambiguity.

## Core Features

| # | Feature | Priority | Description |
|---|---|---|---|
| F1 | Drop `published` flag end-to-end | Critical | Remove the `isPublished` column, all server-side filters that depend on it, the admin toggle, the indexer's default value, and all test fixtures. File presence under `app/content/posts/<locale>/` is the only post-visibility signal. `git rm` is unpublish. |
| F2 | Static-pages directory convention | Critical | Introduce `app/content/pages/<locale>/<slug>.mdx`. Move `about.mdx` into the new location. A single module exposes load, twin-check, and enumeration for all pages — adding a new page is a content-only change. |
| F3 | Language menu: per-item availability hint | Critical | Each item in the language menu carries an inline availability state. When the target-locale twin exists: render the item normally. When it does not: render the item with a "(not available)" hint while keeping it clickable for the confirm-modal flow. Hint logic applies only to content routes (posts + static pages); structural routes (homepage, tag pages, 404) render both items as available. Admin hides the switcher. |
| F4 | Confirm modal on missing twin | Critical | Clicking an unavailable language item opens a modal in the **current page's language** with copy along the lines of "This content is not available in [target language]. You will be redirected to the home page in [target language]. Continue?". Confirm → target-locale home; Cancel → stay on current page. Replaces the silent home-redirect that exists today. |
| F5 | Sitemap.xml with reciprocated hreflang | High | Emit `sitemap.xml` listing every published post and static page. Each entry carries `<xhtml:link rel="alternate" hreflang>` pairs **only** when both locale variants exist; one-way hreflang is never emitted. The homepage entry uses `x-default` pointing to the EN homepage. |
| F6 | Admin index: list + locale filter | High | The `/admin` index lists every post (title, slug, twin-status indicator) with a filter toggle for English / Portuguese / both. Each row exposes a "View" button opening the public URL in a new tab. All write affordances (toggle, edit, new, preview) are removed. |
| F7 | Modal primitive for the language flow | Medium | Adds a reusable accessible dialog primitive to `app/components/ui/`, used by F4. Built on top of the existing component patterns; keyboard-accessible (Escape to cancel, focus trap, return focus on close); screen-reader semantics correct. |

## User Experience

### Author journey (P1)

1. Author writes `app/content/posts/en/my-post.mdx` (and optionally a pt-br twin) in their editor.
2. Author commits the file on a `post/<lang>/<slug>` branch, opens a PR, merges to `main`.
3. CD pipeline runs, deploys; the post is live at `/my-post` (English) and `/pt-br/my-post` (if pt-br twin committed).
4. Author opens `/admin`, filters by "Português (BR)" to verify which posts still need translation, clicks "View" on a post to open the public URL in a new tab.
5. To unpublish: `git rm app/content/posts/en/my-post.mdx`, commit, push, merge. The route 404s on the next deploy.

### Reader journey (P2)

1. Reader lands on `/some-post` (English). The header's language menu shows "English" (current) and "Português (BR)".
2. **Twin exists**: "Português (BR)" item renders normally. Click → navigate to `/pt-br/some-post`. No modal.
3. **Twin missing**: "Português (BR)" item renders with "(not available)" hint and `aria-disabled` semantics. Click → modal opens in English (current language): "This content is not available in Portuguese. You will be redirected to the home page in Portuguese. Continue?". Confirm → navigate to `/pt-br`. Cancel → stay on `/some-post`.
4. On a structural route (`/`, `/tags/react`, 404): both menu items always render as available. Click → navigate to the locale equivalent. No modal.
5. On `/admin/*`: the language menu does not render at all.

### Accessibility

- The language menu items use `aria-disabled="true"` for unavailable items (not `disabled`, which would prevent the click that opens the modal).
- The hint text is announced as part of the item's accessible name (e.g., `aria-label="Português (BR) (not available)"`).
- The modal traps focus while open, returns focus to the triggering menu item on close, supports Escape to cancel, and announces its purpose via `aria-labelledby` / `aria-describedby`.
- Modal action buttons have clear labels in the current page's language ("Continue" / "Cancel" in English; "Continuar" / "Cancelar" in Portuguese).

### Onboarding and discoverability

- The refactor is invisible from a discoverability standpoint — no new navigation entry, no onboarding tour, no announcement banner.
- The author learns the new workflow from the project's content authoring docs (`CONTENT.md`), updated as part of this refactor.

## High-Level Technical Constraints

- Must integrate with the existing branch-naming Ruleset (`TASK-XXXX/slug`, `post/<lang>/<slug>`, `hotfix/*`) without changes.
- Must run inside the existing CI gates (Vitest + Playwright + lint + build) and the CD pipeline's migrate-before-restart ordering (`.agents/rules/cicd.md`).
- Sitemap response time from a reader perspective: < 200 ms p95 (sitemap is read by crawlers and occasionally by humans; perceived speed only matters at very high traffic, which the blog does not have).
- The new modal primitive must work in SSR — initial render must not flash modal contents before hydration.
- The language menu must remain keyboard-navigable on all routes; existing test coverage in `app/tests/header.test.ts` continues to pass.
- All copy strings (menu hint, modal title, modal body, modal buttons, sitemap-related UI) live alongside existing `Record<Locale, string>` patterns — no new i18n catalog or framework.
- All sitemap URLs use the canonical production origin (no localhost references in deployed output).

## Non-Goals (Out of Scope)

- **Pre-commit frontmatter validator / draft guardrail tooling** — Per Q-PRD5, V1 relies on existing branch convention as the only guardrail; no new Lefthook step.
- **Indexing static pages into the database** — Per ADR-001, static pages stay filesystem-only behind the encapsulated `pages.server.ts` module. Trigger to revisit: page count > 5 or a feature needs queryable per-page metadata.
- **Admin write affordances** — No create, edit, delete, or publish-toggle UI in V1. Author writes MDX in their editor.
- **Admin metrics dashboard / translation-gap dashboard with chart visualizations** — V1 admin = list + locale filter only. Dashboard work deferred to a future V2 task.
- **Translation-aware in-content reading layer** — The "available in: 🇺🇸 EN · 🇧🇷 PT-BR" inline post-header marker, per-locale RSS feeds, and translation-coverage dashboards are V2 stretch goals from the idea phase.
- **Build-time twin manifest** — Listed in ADR-003 as the V2 escape hatch if loader-context plumbing ever becomes painful for new route types. Not needed for V1 because `PostEntry.hasTwin` and `staticPageHasTwin` already cover the routes we have.
- **Branch-preview deploys (per-branch public preview URLs)** — Adjacent opportunity surfaced in the idea phase; out of scope (requires infra refactor — wildcard DNS, Traefik labels — well beyond a content refactor).
- **Scheduled publishing** — Incompatible with file-presence visibility; accepted trade-off per the idea phase.
- **Renaming the project's CSS framework, replacing Tailwind, or any unrelated UI overhaul** — Refactor is content + i18n + admin only.

## Phased Rollout Plan

### MVP (Phase 1) — Single release

- **Included**: F1, F2, F3, F4, F5, F6, F7 (all seven Core Features). All ship as one PR on `TASK-0008/posts-publish-refactor`, merged to `main`, deployed by CD.
- **Per-concern commits** within the branch keep the diff narrative readable: one commit per feature where practical, mapping cleanly to the seven feature IDs.
- **Success criteria to consider Phase 1 complete**:
  - CI green on the PR (Vitest + Playwright + lint + build all pass).
  - Manual smoke matches every user story in this PRD.
  - `content-audit` skill run after deploy shows zero new translation-gap regressions; `app-audit` shows zero new console / hydration / a11y / Lighthouse blockers attributable to the refactor.
  - Author confirms the publish workflow end-to-end: write `.mdx`, commit, push, merge, observe live URL within one CD cycle.

### Phase 2 (Future, separate task)

- Translation-aware in-content reading layer: post-header twin marker, per-locale RSS feeds, hreflang on RSS.
- Admin translation-gap dashboard.
- Trigger to start Phase 2: any of (a) post count exceeds 10 and fewer than 50% have twins, (b) a direct reader request for the in-content marker, (c) sitemap-driven SEO data shows the bilingual surface paying off and warrants amplification.

### Phase 3 (Long-term)

- Build-time twin manifest (ADR-003 V2 escape hatch).
- Admin metrics dashboard (page views per post, top referrers).
- Trigger: a sustained editorial workflow (any indicator the blog is no longer single-author / single-frequency).

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Steps from "post written" to "post live" | 1 (`git push` + merge) | Manual workflow count, before vs after |
| Silent language-switcher home-redirects when a twin exists | 0 | E2E spec: switch direction in both ways on every fixture post that has both twins, assert URL = twin slug, no modal |
| Confirm-modal appearance rate when twin is missing | 100% | E2E spec: switch direction in both ways on every fixture post that lacks a twin, assert modal opens; assert modal copy is in the current page's language |
| Static page added with zero code edits | True | Smoke test: drop `app/content/pages/en/uses.mdx`, dev server picks it up, route renders, audit + sitemap include it — zero edits in `app/routes/`, `app/lib/`, or `app/components/` |
| Asymmetric `hreflang` violations on `sitemap.xml` | 0 | Sitemap test: parse emitted `sitemap.xml`; for every `<xhtml:link rel="alternate" hreflang>` annotation, assert the referenced URL is also present in the sitemap with a reciprocal annotation |
| Admin LOC after trim | < 100 (down from 262 today) | `wc -l app/routes/admin/**` post-merge |
| `/admin/preview/$slug` request count per week post-deploy | 0 | Server access logs (deleted route returns 404 by definition; metric verifies no internal/external caller still hits it) |

## Risks and Mitigations

- **Reader confusion if the menu hint copy is unclear** — A blunt "(not available)" may read as "the language is broken." *Mitigation*: capture copy as an Open Question (Q-O3) and resolve with the author before merge; consider alternatives like "(no translation)" or "(only in EN)" with the choice documented in the PRD's acceptance.
- **Sitemap or hreflang misconfiguration causes SEO regression** — Asymmetric or duplicate `hreflang` is a real ranking risk per market research. *Mitigation*: the sitemap test (Success Metric #5) gates on reciprocity; a manual `curl /sitemap.xml | xmllint --format` review is part of the pre-merge smoke checklist.
- **Reader-trust erosion if the modal fires on the majority of switcher clicks** — Council debate's primary concern about modal fatigue. *Mitigation*: the per-item hint (F3) makes the modal a confirmation, not a discovery, addressing the council's concern at the surface layer.
- **Adoption risk for the new authoring workflow** — Author needs to internalize "file presence = live." *Mitigation*: `CONTENT.md` updated as part of this refactor; first post written after the refactor merges acts as the validation moment. Branch convention provides a natural guard against WIP commits.
- **External link rot from deleted `/admin/preview/$slug`** — Any bookmarks or in-flight share links to preview URLs will 404. *Mitigation*: the route is admin-only and was used solely by the author; no external sharing is plausible. Risk is essentially zero.

## Architecture Decision Records

- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — Pages stay on disk; all access goes through a single module; no DB indexing for low-cardinality structural content.
- [ADR-002: Language-switcher missing-twin UX = modal-only for V1](adrs/adr-002.md) — **Superseded by ADR-003.**
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — Hint surfaces in the dropdown menu items before the click; modal becomes confirmation. Replaces ADR-002 after PRD clarification.
- [ADR-004: Rollout = single release for V1](adrs/adr-004.md) — All seven Core Features ship in one PR / one deploy.

## Open Questions

- **Q-O1**: Final wording for the menu-item availability hint — "(not available)", "(no translation)", "(only in EN)", or other. To resolve with the author before merge; tests should not hardcode the exact string until then.
- **Q-O2**: Final wording for the modal title, body, and button labels in both EN and PT-BR. Initial proposed copy is in the User Experience section; final copy lands via PR review.
- **Q-O3**: Should `sitemap.xml` include a `changefreq` or `priority` hint per entry? Both are advisory per Google Search Central in 2026 (largely ignored). Default proposal: omit both for V1.
- **Q-O4**: Should the admin locale filter persist across page refreshes (e.g., URL search param, `localStorage`)? Default proposal: URL search param (no client-side persistence dependency).
- **Q-O5**: Where exactly do the "view-in-new-tab" buttons in admin link to — slug-based public URL on the *current* locale, or always EN? Default proposal: links to the locale variant that exists; if both exist, defaults to EN; if only one exists, links to that one.
