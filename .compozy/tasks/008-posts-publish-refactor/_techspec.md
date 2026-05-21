# TechSpec — Posts Publish Refactor

## Executive Summary

The refactor lands as a single release on `TASK-0008/posts-publish-refactor` per ADR-004. The primary architectural change consolidates the dynamic-slug route — `app/routes/{-$locale}/$slug.tsx` becomes the single resolution surface for both blog posts and static pages, with posts winning on slug collision (ADR-005). Static pages move into `app/content/pages/<locale>/` and are served entirely from the filesystem through a single encapsulated module (ADR-001), eliminating the per-page loader anti-pattern that the existing `about.tsx` route represented. The language switcher gains per-menu-item availability hints (ADR-003) backed by a unified `getTwinAvailabilityForCurrentRoute` helper that fans out to `PostEntry.hasTwin` for posts and `staticPageHasTwin` for pages, with a `@radix-ui/react-dialog`-based confirm modal (ADR-006) catching the missing-twin click path. A new `/sitemap.xml` route generates reciprocated hreflang pairs per-request (ADR-007), mirroring the existing `robots[.]txt.ts` content-type idiom.

The primary technical trade-off is dependency growth: adding `@radix-ui/react-dialog` (~12 kB gzipped) buys production-grade a11y and a shadcn-compatible API surface in exchange for a new runtime dep that the codebase did not previously carry. Every other change is dependency-neutral or dependency-reducing (admin trim removes 162+ LOC; `about.tsx` route gets deleted; `isPublished` column and three filter sites get removed).

## System Architecture

### Component Overview

| Component | Responsibility | Boundary |
|---|---|---|
| `app/db/schema.ts` | Drizzle `posts` table definition without `isPublished` | DB layer |
| `app/db/queries.ts` | Post lookups without visibility filters | DB layer |
| `app/db/indexer.ts` | File-watcher → Drizzle upsert; no `isPublished` field | DB layer |
| `app/lib/mdx/pages.server.ts` *(new)* | Sole entry point for static page load, twin-check, enumeration | Content layer |
| `app/lib/site-model.server.ts` | `PostEntry.hasTwin` (existing); rename `getLatestPublishedSlug` → `getLatestPostSlug` | Content layer |
| `app/lib/content-audit/checks.server.ts` | Add `slug-collision` finding; consume `enumerateStaticPages` for translation-gap parity on pages | Audit layer |
| `app/components/ui/dialog.tsx` *(new)* | Radix-Dialog wrapper exposing shadcn-style compound API | UI primitives |
| `app/components/ui/missing-twin-dialog.tsx` *(new)* | Concrete confirm modal for the missing-twin flow | UI |
| `app/components/ui/language-menu.tsx` | Render per-item `available` state; emit click events the switcher hook intercepts | UI |
| `app/components/layout/header.tsx` | Rewritten `useLangSwitcher` using TanStack `<Link params={(prev)=>...}>` + missing-twin-dialog trigger; hide menu on `/admin/*` | UI |
| `app/lib/locale.tsx` | `buildLocaleHead` updated to emit hreflang only when twin exists | i18n/SEO |
| `app/routes/{-$locale}/$slug.tsx` | Unified loader: post → page → 404 | Route layer |
| `app/routes/{-$locale}/about.tsx` + `about.server.ts` | **Deleted** | — |
| `app/routes/sitemap[.]xml.ts` *(new)* | Per-request XML, reciprocated hreflang | Route layer |
| `app/routes/admin/index.tsx` + `index.server.ts` | List view + EN/PT-BR/both locale filter; no write fns | Route layer |
| `app/routes/admin/preview.$slug.tsx` + `preview.$slug.server.ts` | **Deleted** | — |

### Data Flow

- **Reader request → `/some-slug`**: route loader calls `getPostBySlugWithLangFn` first; on miss calls `loadStaticPage(slug, locale)`; on miss throws `notFound()`. The chosen branch renders MDX through the existing `renderMdx` pipeline.
- **Language menu open**: layout supplies `targetLocaleHasTwin` via `getTwinAvailabilityForCurrentRoute(routeContext)` which dispatches on route type: post route → `PostEntry.hasTwin`; static page route → `staticPageHasTwin(slug, targetLocale)`; structural route → `true`; admin route → menu not rendered at all.
- **Switcher click**: TanStack `<Link>` is wrapped in `onClickCapture`. If item.available → default navigation. Else → preventDefault + open `<MissingTwinDialog>`. Confirm → router navigate to target-locale home (`/` or `/pt-br/`). Cancel → close dialog, focus returns to the menu item.
- **Crawler request → `/sitemap.xml`**: route handler calls `getSitemapEntriesFn` → reads posts via Drizzle + pages via `enumerateStaticPages` (both locales) → for each, lookup twin → render XML string → `Response` with `content-type: application/xml`.

## Implementation Design

### Core Interfaces

`app/lib/mdx/pages.server.ts` — the encapsulation boundary per ADR-001:

```ts
export type PageEntry = {
  slug: string;
  locale: Locale;
  filePath: string;
  frontmatter: PageFrontmatter;
};

export type PageFrontmatter = {
  title: string;
  description?: string;
};

export async function loadStaticPage(
  slug: string,
  locale: Locale
): Promise<{ entry: PageEntry; html: string } | null>;

export function staticPageHasTwin(slug: string, targetLocale: Locale): boolean;

export async function enumerateStaticPages(
  locale: Locale
): Promise<PageEntry[]>;
```

`app/lib/locale.tsx` — twin-availability dispatcher added next to existing locale primitives:

```ts
export type RouteKind =
  | { kind: "post"; slug: string; hasTwin: boolean }
  | { kind: "page"; slug: string }
  | { kind: "structural" }
  | { kind: "admin" };

export function getTwinAvailabilityForCurrentRoute(
  route: RouteKind,
  targetLocale: Locale
): { available: boolean; renderSwitcher: boolean };
```

`app/components/ui/dialog.tsx` — Radix wrapper (shadcn-compatible compound):

```tsx
type DialogProps = React.ComponentProps<typeof RadixDialog.Root>;
export const Dialog: React.FC<DialogProps>;
export const DialogTrigger: typeof RadixDialog.Trigger;
export const DialogContent: React.FC<{ children: React.ReactNode }>;
export const DialogHeader: React.FC<{ children: React.ReactNode }>;
export const DialogTitle: typeof RadixDialog.Title;
export const DialogDescription: typeof RadixDialog.Description;
export const DialogFooter: React.FC<{ children: React.ReactNode }>;
export const DialogClose: typeof RadixDialog.Close;
```

`app/routes/sitemap[.]xml.server.ts` — per-request sitemap source:

```ts
export type SitemapEntry = {
  loc: string;
  alternates: Array<{ hreflang: string; href: string }>;
  isDefault?: boolean;
};

export const getSitemapEntriesFn: ServerFn<() => Promise<SitemapEntry[]>>;
```

### Data Models

- **`posts` table** — unchanged shape after the `isPublished` column drop. All other columns (`slug`, `lang`, `title`, `date`, `frontmatter`, `filePath`, etc.) remain.
- **Static pages** — no DB representation. Frontmatter (`title`, optional `description`) parsed at load time. Twin is `existsSync(app/content/pages/<targetLocale>/<slug>.mdx)`.
- **`PageFrontmatter`** — minimal: `title` required, `description` optional. Pages do not carry `date`, `series`, `category`, or `noTranslation` (those are post-specific).
- **`RouteKind` discriminated union** — drives switcher rendering and twin resolution.

### API Endpoints

| Method | Path | Purpose | Status codes |
|---|---|---|---|
| GET | `/{-$locale}/$slug` | Resolve post or static page by slug (post wins on collision) | 200, 404 |
| GET | `/sitemap.xml` | Bilingual sitemap with reciprocated hreflang | 200 |
| GET | `/robots.txt` | *(existing)* | 200 |
| GET | `/admin` | List view + locale filter (EN/PT-BR/both via `?locale=` search param) | 200, 302 (auth redirect) |
| ~~GET~~ | ~~`/admin/preview/$slug`~~ | **Deleted** | — |
| ~~POST~~ | ~~`/admin/togglePublished`~~ | **Deleted** (server fn removed; no UI calls it) | — |

## Integration Points

- **`@radix-ui/react-dialog`** *(new runtime dep)* — installed via `bun add`; consumed only by `app/components/ui/dialog.tsx`. No service-side integration; bundle impact ~12 kB gzipped on routes that import a dialog use site. Peer dep alignment: React 19 (already satisfied).
- **Drizzle-kit migration runtime** *(existing)* — `bun run db:generate` produces `drizzle/000N_*.sql` for the `isPublished` column drop; `bun run db:migrate` (via `scripts/migrate.ts`) runs it under the CD pipeline's migrate-before-restart ordering per `.agents/rules/cicd.md`.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `app/db/schema.ts` | modified | Drop `isPublished` column. Risk: low (2 fixture posts, no real data). | Update schema; generate migration. |
| `drizzle/000N_*.sql` *(new)* | new | Single migration: `ALTER TABLE posts DROP COLUMN is_published`. | Generate via drizzle-kit. |
| `app/db/queries.ts` | modified | Remove `eq(posts.isPublished, true)` from `getPublishedPostsFn`; rename to `getAllPostsFn` or `listPostsFn`. | Update + rename + update callers. |
| `app/db/indexer.ts` | modified | Remove hardcoded `isPublished: false` at `:97` and skip at `:117`. | Delete those lines. |
| `app/routes/{-$locale}/$slug.server.ts` | modified | Remove `isPublished` filter from 3 lookup paths (`:43,60,77`); add static-page fallback chain. | Rewrite loader. |
| `app/lib/site-model.server.ts` | modified | `getLatestPublishedSlug` → `getLatestPostSlug`; no filter. | Rename + update callers. |
| `app/lib/mdx/pages.server.ts` | new | Encapsulation module per ADR-001. | Create. |
| `app/lib/mdx/about.server.ts` | deprecated | Replaced by `pages.server.ts`. | Delete. |
| `app/content/<locale>/about.mdx` | moved | → `app/content/pages/<locale>/about.mdx`. | `git mv` preserves history. |
| `app/routes/{-$locale}/about.tsx` + `about.server.ts` | deprecated | Resolved by unified `$slug.tsx` loader. | Delete both. |
| `app/routes/{-$locale}/$slug.tsx` | modified | Loader: post → page → 404. | Update loader. |
| `app/components/ui/dialog.tsx` | new | Radix wrapper. | Create. |
| `app/components/ui/missing-twin-dialog.tsx` | new | Confirm modal with inline `Record<Locale, …>` copy. | Create. |
| `app/components/ui/language-menu.tsx` | modified | Per-item `available` prop; aria-disabled hint label. | Update. |
| `app/components/layout/header.tsx` | modified | Rewrite `useLangSwitcher`; hide menu on `/admin/*`. | Replace hardcoded `if`-chain with TanStack `<Link params=...>` + modal trigger. |
| `app/lib/locale.tsx` | modified | Add `getTwinAvailabilityForCurrentRoute` + `RouteKind`; update `buildLocaleHead` to emit hreflang only when twin exists. | Extend module. |
| `app/lib/content-audit/checks.server.ts` | modified | Add `slug-collision` finding; consume `enumerateStaticPages` for page translation-gap parity. | Extend. |
| `app/routes/sitemap[.]xml.ts` + `.server.ts` | new | Per-request XML emission. | Create both. |
| `app/routes/admin/index.tsx` | modified | Trim to list + `?locale=` filter; "View" buttons → public URL `target="_blank"`. | Rewrite UI; drop toggle. |
| `app/routes/admin/index.server.ts` | modified | Keep `getAllPostsFn`, drop `togglePublishedFn`. | Remove fn. |
| `app/routes/admin/preview.$slug.tsx` + `preview.$slug.server.ts` | deprecated | Per Q4 lock. | Delete both. |
| `app/tests/admin-routes.test.ts` | modified | Strip `isPublished` fixtures; remove toggle tests; add locale-filter test. | Update. |
| `app/tests/indexer.test.ts` | modified | Strip `isPublished` field at `:80`. | Update. |
| `app/tests/lang-slug-route.test.ts` | modified | Strip `isPublished` at `:79, :331+`. | Update. |
| `app/tests/site-model.test.ts` | modified | Strip `isPublished` at multiple lines. | Update. |
| `app/tests/locale.test.ts` | modified | Add `getTwinAvailabilityForCurrentRoute` unit tests. | Extend. |
| `app/tests/header.test.ts` | modified | Add per-item `available` rendering tests. | Extend. |
| `app/tests/pages.test.ts` *(new)* | new | Cover `loadStaticPage`, `staticPageHasTwin`, `enumerateStaticPages`. | Create. |
| `app/tests/sitemap.test.ts` *(new)* | new | Reciprocity invariant across mixed twin/no-twin fixtures. | Create. |
| `app/tests/content-audit.test.ts` *(if exists)* / new | modified or new | Cover `slug-collision` finding. | Extend or create. |
| `tests/e2e/public-read.spec.ts` | modified | Add en → pt-br direction; menu hint render; modal confirm path; modal cancel path. | Extend spec. |
| `tests/e2e/admin-write.spec.ts` (if exists) | modified | Remove publish-toggle assertions; add locale-filter assertion. | Update. |
| `CONTENT.md` | modified | Document file-presence semantics + static-pages convention. | Update. |
| `package.json` | modified | Add `@radix-ui/react-dialog` dep. | `bun add @radix-ui/react-dialog`. |

## Testing Approach

### Unit Tests (Vitest)

- **`app/tests/pages.test.ts`** *(new)* — covers `loadStaticPage`, `staticPageHasTwin`, `enumerateStaticPages`. Uses `vi.mock("node:fs/promises")` per existing `about.test.ts` pattern. Critical scenarios: page exists; page missing; twin exists; twin missing; both locales; corrupt frontmatter.
- **`app/tests/locale.test.ts`** *(extended)* — `getTwinAvailabilityForCurrentRoute` for each `RouteKind`: post with/without twin, page with/without twin, structural (always available), admin (hides menu).
- **`app/tests/sitemap.test.ts`** *(new)* — fixture set covers: post EN+PT-BR (both alternates), post EN-only (no alternates), page EN+PT-BR (both alternates), homepage (`x-default`). Assert reciprocity invariant: every `<xhtml:link>` annotation references a URL that also exists in the urlset with a reciprocal annotation.
- **`app/tests/header.test.ts`** *(extended)* — per-item `available` rendering (label + aria-disabled); hide-menu-on-admin assertion.
- **`app/tests/admin-routes.test.ts`** *(modified)* — strip publish toggle; add locale filter assertions (URL `?locale=en` filters list; `?locale=pt-br` filters list; absent param shows all).
- **`app/tests/indexer.test.ts`, `lang-slug-route.test.ts`, `site-model.test.ts`** *(modified)* — strip `isPublished` from fixtures; add `slug-collision` audit-check fixture if extending `content-audit.test.ts`.

### Integration / E2E Tests (Playwright)

- **`tests/e2e/public-read.spec.ts`** *(extended)*:
  - **en → pt-br round-trip**: navigate to `/` (EN homepage) → open menu → click "Português (BR)" → assert URL `/pt-br/`, no modal. (Currently broken per `:77` documentation.)
  - **menu hint state**: navigate to fixture post that has no pt-br twin → open menu → assert "Português (BR)" item carries hint text + `aria-disabled="true"`.
  - **modal confirm path**: click the unavailable item → assert dialog open → assert dialog copy is in current page's language → click "Continue" → assert navigation to `/pt-br/`.
  - **modal cancel path**: same setup → click "Cancel" → assert dialog closed → assert URL unchanged → assert focus on the menu item.
  - **sitemap reciprocity smoke**: GET `/sitemap.xml` → assert `Content-Type: application/xml` → parse → assert reciprocity invariant on the fixture set.
- **`tests/e2e/admin-write.spec.ts`** *(modified if present, else create)* — locale-filter URL roundtrip; assert "View" buttons open in `_blank`.

## Development Sequencing

### Build Order

All steps land in commits on `TASK-0008/posts-publish-refactor`. The branch merges to `main` as a single PR per ADR-004; the commit-level granularity below keeps the diff narrative reviewable.

1. **DB migration: drop `isPublished`** — update `app/db/schema.ts`; run `bun run db:generate`; commit the generated `drizzle/000N_*.sql`. *(No deps.)*
2. **Code cleanup: remove visibility filters** — `app/db/queries.ts`, `app/routes/{-$locale}/$slug.server.ts`, `app/lib/site-model.server.ts`, `app/db/indexer.ts`. Rename `getLatestPublishedSlug` → `getLatestPostSlug`; rename `getPublishedPostsFn` → `getAllPostsFn` (or analogous). *(Depends on step 1.)*
3. **Pages module** — create `app/lib/mdx/pages.server.ts` with `loadStaticPage`, `staticPageHasTwin`, `enumerateStaticPages`. *(No deps; can run parallel with steps 1–2.)*
4. **Content + route migration** — `git mv app/content/<locale>/about.mdx app/content/pages/<locale>/about.mdx`. Delete `app/routes/{-$locale}/about.tsx` + `about.server.ts`. Delete `app/lib/mdx/about.server.ts`. *(Depends on step 3.)*
5. **Unified slug route** — modify `app/routes/{-$locale}/$slug.tsx` + `.server.ts`: loader tries post then `loadStaticPage` then `notFound`. *(Depends on steps 2, 3, 4.)*
6. **Content-audit collision check** — add `slug-collision` finding to `app/lib/content-audit/checks.server.ts`; consume `enumerateStaticPages` for page translation-gap parity. *(Depends on step 3.)*
7. **Dialog primitive** — `bun add @radix-ui/react-dialog`; create `app/components/ui/dialog.tsx` shadcn-style wrapper. *(No deps; can run parallel.)*
8. **Missing-twin dialog** — create `app/components/ui/missing-twin-dialog.tsx` with inline `Record<Locale, …>` copy. *(Depends on step 7.)*
9. **Twin-availability helper + menu state** — add `RouteKind` + `getTwinAvailabilityForCurrentRoute` to `app/lib/locale.tsx`; update `app/components/ui/language-menu.tsx` to render per-item `available` state with aria-disabled hint label. *(Depends on step 3.)*
10. **Switcher rewrite** — replace `useLangSwitcher` if-chain in `app/components/layout/header.tsx` with TanStack `<Link params={(prev) => …}>` + `<MissingTwinDialog>` trigger; hide menu on `/admin/*`. *(Depends on steps 8, 9.)*
11. **Sitemap route** — `app/routes/sitemap[.]xml.ts` + co-located `.server.ts` (`getSitemapEntriesFn`). Reads from steps 2 + 3 sources. *(Depends on steps 2, 3.)*
12. **Hreflang emission** — update `buildLocaleHead` in `app/lib/locale.tsx` to emit `<link rel="alternate" hreflang>` only when twin exists. *(Depends on steps 2, 3.)*
13. **Admin trim + locale filter** — modify `app/routes/admin/index.tsx` + `index.server.ts`: drop `togglePublishedFn`, add `?locale=` filter UI. Delete `preview.$slug.tsx` + `preview.$slug.server.ts`. *(Depends on step 2.)*
14. **Test sweep** — strip `isPublished` from existing test fixtures; add new tests per Testing Approach section. *(Depends on all preceding steps.)*
15. **Docs sweep** — update `CONTENT.md` (file-presence semantics + pages convention). *(No deps; can land anytime in the branch.)*

### Technical Dependencies

- `@radix-ui/react-dialog` available on npm (uncontroversial; major-version stable).
- `drizzle-kit` already installed; no version bump required.
- TanStack Router file-route registry will regenerate `app/routeTree.gen.ts` on dev-server boot after the route delete/move — no manual edit per `.agents/rules/routes.md`.
- CD pipeline migrate-before-restart ordering already in place (`.agents/rules/cicd.md`) — covers the migration safety for step 1.

## Monitoring and Observability

- **Indexer**: existing error logs in `app/db/indexer.ts` cover file-watcher failures. No new instrumentation required.
- **Sitemap**: route handler logs (server-side) on render errors. No metrics needed at blog scale; the route is a single read.
- **Switcher**: no telemetry instrumented in V1. The PRD documents V2 trigger conditions for ADR-003 reconsideration (modal-dismiss rate, switcher engagement) — telemetry would be added only when that V2 trigger fires.
- **Audit**: existing `content-audit` + `app-audit` skills surface regressions via the standard `docs/_reports/*.md` + `docs/audits/SUMMARY.md` pipeline. The new `slug-collision` finding category becomes visible to that pipeline automatically.

## Technical Considerations

### Key Decisions

- **Unified `$slug.tsx` loader, posts win on collision** (ADR-005) — single resolution surface; collision risk handled at audit time via the new `slug-collision` finding rather than runtime hard-fail.
- **`@radix-ui/react-dialog` for the modal primitive** (ADR-006) — bundle cost (~12 kB gzipped) accepted in exchange for production-grade a11y + shadcn-compatible API surface.
- **Per-request sitemap generation, no cache** (ADR-007) — simplest pattern; matches `robots[.]txt.ts`; freshness over latency at blog scale.
- **Drizzle migration: single-phase column drop, co-deployed with code** — safe under CD's migrate-before-restart ordering; the 2-fixture corpus has no data trapped behind the flag; no two-phase staging needed.
- **Modal copy: inline `Record<Locale, string>` in the component** — matches existing pattern at `app/components/ui/language-menu.tsx:6-24`; no new i18n catalog.
- **Test layering: unit (helpers) + E2E (flow)** — matches existing project patterns; no `@testing-library/react` or `jest-axe` dep added in this PR. A11y of the Radix dialog is covered by Radix's own audited semantics + e2e keyboard/focus assertions.

### Known Risks

- **Bundle size growth from Radix Dialog** (~12 kB gzipped). *Mitigation*: Radix is tree-shakeable; only the routes that import a dialog use site pay the cost. Inspect bundle output after step 7 to confirm.
- **Hydration mismatch on Radix portal**: SSR-rendered portal vs client. *Mitigation*: gate `<DialogContent>` rendering with a mounted flag in the wrapper if the Radix default produces hydration warnings. Standard Radix pattern; covered by e2e smoke.
- **Slug collision silently shadowing pages**. *Mitigation*: new `slug-collision` finding in content-audit (warning severity) — surfaces in `docs/_reports/content-audit-YYYY-MM-DD.md` on the next audit run; not a runtime failure.
- **Asymmetric hreflang regression**. *Mitigation*: dedicated reciprocity unit test in `app/tests/sitemap.test.ts` (Success Metric #5 enforcement).
- **`PostFrontmatter` type drift vs database row** — removing the `isPublished` field from the schema must be paired with removing it from any TS shape that mirrors the row (e.g., `PostEntry` in `site-model.server.ts`). *Mitigation*: TS compiler errors will catch all references on the next `bun run check` after step 1.
- **Admin locale filter URL behavior on bookmark / refresh** — Q-O4 in the PRD locks the URL-search-param approach; no client-side persistence dependency to manage.

## Architecture Decision Records

- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — Pages stay on disk; all access through `pages.server.ts`; no DB indexing.
- [ADR-002: Language-switcher missing-twin UX = modal-only for V1](adrs/adr-002.md) — **Superseded by ADR-003.**
- [ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal](adrs/adr-003.md) — Hint surfaces on dropdown items before click; modal becomes confirmation.
- [ADR-004: Rollout = single release for V1](adrs/adr-004.md) — One PR, one deploy, seven Core Features.
- [ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision](adrs/adr-005.md) — Single dynamic-slug route, post lookup → page lookup → 404; audit-time warning on collision.
- [ADR-006: Modal primitive = `@radix-ui/react-dialog`](adrs/adr-006.md) — Radix wrapper in `app/components/ui/dialog.tsx`, shadcn-compatible API.
- [ADR-007: Sitemap.xml generated per-request, no cache](adrs/adr-007.md) — Per-request reads from DB + filesystem; mirrors `robots[.]txt.ts` idiom.
