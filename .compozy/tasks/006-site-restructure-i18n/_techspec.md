# TechSpec — Site Restructure: Organic Content with Locale Foundation

## Executive Summary

V1 restructures the personal blog into a post-feed homepage with URL-prefix locale routing, migrates About to MDX-per-locale, adopts a typed Zod-validated `UIStrings` i18n contract, and stabilizes the post indexing pipeline so deploys reliably populate the `posts` table. The work ships in three sequential phases per ADR-002 (slim down + stabilize → route restructure → content + i18n contract).

Key architectural decisions: adopt TanStack Router's optional path-param `{-$locale}` to express default-locale `/` and `/pt-br/` in one route subtree (ADR-004); auto-redirect Portuguese browsers from `/` to `/pt-br/` via cookie-first SSR detection (ADR-005); serve About directly from MDX without DB persistence (ADR-006); introduce Zod as the project's validation primitive for new validation surfaces (ADR-007); fix the dev-boot indexer gap via a new `[sync]` step in the existing `content-watcher-dev` Vite plugin and a new `bun run sync` step in `scripts/deploy.sh` (ADR-003).

Primary trade-off: the optional-param routing primitive and cookie-first redirect add a small amount of SSR complexity and require `Vary: Cookie, Accept-Language` headers on `/`, but they buy a clean canonical URL surface, idiomatic TanStack Router structure, and automatic locale routing for Portuguese visitors. The Zod adoption introduces a ~12 KB dependency in exchange for typed schema-driven validation that the existing inline validators do not provide.

## System Architecture

### Component Overview

The implementation touches eight distinct components across the existing codebase. Each owns a narrow responsibility; data flows from filesystem (`content/`) through the indexer and MDX pipeline into the route layer, which renders SSR HTML.

- **Optional-locale route subtree** (`app/routes/{-$locale}/`): hosts the locale layout, post feed index, post detail, and About page. Resolves the optional `_locale` param to `DEFAULT_LOCALE` when undefined. Each route file pairs with a co-located `*.server.ts` server-fn module.
- **`{-$locale}/` layout** (`app/routes/{-$locale}.tsx`): replaces the existing `$lang.tsx`. Validates the resolved locale against `LOCALES`; renders `<Outlet />`. Owns the cookie-first SSR redirect for the index route via `beforeLoad`.
- **Post feed loader** (`app/routes/{-$locale}/index.tsx` + `index.server.ts`): replaces `$lang/blog.tsx`. Reads `getPublishedPostsFn(locale)`; renders post cards with hreflang pairs.
- **Post detail loader** (`app/routes/{-$locale}/$slug.tsx` + `$slug.server.ts`): replaces `$lang/$slug.tsx`. Existing translation fallback preserved.
- **About MDX loader** (`app/routes/{-$locale}/about.tsx` + `about.server.ts`): new. Calls `loadAbout(locale)`; renders typed frontmatter + compiled MDX body.
- **About helper** (`app/lib/mdx/about.server.ts`): new. Reads `content/<locale>/about.mdx`, calls `parseFrontmatter`, validates with `aboutFrontmatterSchema`, calls `renderMdx`. Returns typed `AboutContent`.
- **UIStrings module** (`app/lib/i18n/strings.ts`): new. Exports `type UIStrings`, `const strings: Record<Locale, UIStrings>`, `uiStringsSchema`. Module load runs `uiStringsSchema.parse(strings[locale])` per locale.
- **Locale primitives** (`app/lib/locale.tsx`): unchanged. Existing `detectLocaleFromRequest`, `LocaleProvider`, `useLocale`, `LOCALES`, `DEFAULT_LOCALE` are reused as-is.
- **Indexer stabilization** (`vite.config.ts` `content-watcher-dev` plugin + `scripts/deploy.sh`): the Vite plugin gains an explicit `[sync]` labeled step between migrate/seed and watcher spawn that calls `syncAll('./content')`. The deploy script gains a `docker run` step that invokes `bun run sync` against the pulled runner image before bringing the app container up.
- **Static `robots.txt` route** (`app/routes/robots[.]txt.ts`): new. Returns a `Response` with `text/plain` content-type. Future-proof for V2 sitemap injection.

Data flow:
- `bun run dev` → vite boots → `content-watcher-dev` plugin runs `[migrate]` → `[seed]` → `[sync]` (syncAll) → spawns watcher subprocess → app SSR renders pages backed by populated DB.
- CD pipeline → builds image with `content/` baked in → SSH to VPS → `docker run ... bun run db:migrate` → `docker run ... bun run sync` → `docker compose up -d --no-deps app`.
- Visitor hits `/` → `{-$locale}.tsx` `beforeLoad` reads cookie + Accept-Language via `detectLocaleFromRequest` → 302 to `/pt-br/` if needed, otherwise renders `{-$locale}/index.tsx` (en feed) → `getLocalePosts({ data: locale })` server fn → `getPublishedPostsFn(locale)` → `db.select() ... ` → returns rows → renders cards with hreflang pairs.
- Visitor hits `/about` → `{-$locale}/about.tsx` loader → `loadAbout('en')` → reads `content/en/about.mdx` → `parseFrontmatter` → `aboutFrontmatterSchema.parse` → `renderMdx(body)` → returns `AboutContent` → component renders.

## Implementation Design

### Core Interfaces

**UIStrings schema** (in `app/lib/i18n/strings.ts`)

```typescript
import { z } from "zod";

export const uiStringsSchema = z.object({
  localeSwitcher: z.object({
    label: z.string(), // own-language label
  }),
  postMeta: z.object({
    publishedOn: z.string(),
    readingTime: z.string(),
  }),
  notFound: z.object({
    title: z.string(),
    body: z.string(),
    homeCta: z.string(),
  }),
});

export type UIStrings = z.infer<typeof uiStringsSchema>;
```

**UIStrings module exports** (same file)

```typescript
import { LOCALES, type Locale } from "#/lib/locale";

export const strings: Record<Locale, UIStrings> = {
  en: { /* populated */ },
  "pt-br": { /* populated */ },
};

// Throws at module load if any locale's strings fail schema.
for (const locale of LOCALES) uiStringsSchema.parse(strings[locale]);
```

**About frontmatter schema** (in `app/lib/mdx/about.server.ts`)

```typescript
import { z } from "zod";
import { LOCALES } from "#/lib/locale";

const linkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.enum(["github", "linkedin", "email", "other"]),
});

export const aboutFrontmatterSchema = z.object({
  title: z.string(),
  locale: z.enum(LOCALES),
  links: z.array(linkSchema).optional().default([]),
});

export type AboutFrontmatter = z.infer<typeof aboutFrontmatterSchema>;
```

**About loader contract** (same module)

```typescript
import type { Locale } from "#/lib/locale";

export type AboutContent = {
  frontmatter: AboutFrontmatter;
  html: string;
  locale: Locale;
  fallbackLocale?: Locale; // set when locale file missing
};

export async function loadAbout(locale: Locale): Promise<AboutContent>;
```

**Cookie-first redirect at `/`**

```typescript
// app/routes/{-$locale}/index.tsx
export const Route = createFileRoute("/{-$locale}/")({
  beforeLoad: async ({ params, location }) => {
    if (params._locale !== undefined) return; // already locale-prefixed
    const req = getRequest();
    const detected = detectLocaleFromRequest(req);
    if (detected !== DEFAULT_LOCALE) {
      throw redirect({ to: `/${detected}/`, statusCode: 302 });
    }
    // set Vary header for caches
    setResponseHeader("Vary", "Cookie, Accept-Language");
  },
  loader: ({ params }) => getLocalePosts({ data: params._locale ?? DEFAULT_LOCALE }),
  component: PostFeed,
});
```

### Data Models

The only new data structure is `AboutContent` (see above). No new DB tables. No schema migration. The existing `posts` table is unchanged.

| Model | Source | Validation |
|---|---|---|
| `AboutContent` | `content/<locale>/about.mdx` | Zod (`aboutFrontmatterSchema`) at loader time |
| `AboutFrontmatter` | MDX frontmatter | Zod (`aboutFrontmatterSchema`) |
| `Link` (in `links[]`) | MDX frontmatter array entry | Zod (`linkSchema`) |
| `UIStrings` | `app/lib/i18n/strings.ts` constant | Zod (`uiStringsSchema`) at module load |

The `posts` table schema in `app/db/schema.ts` remains as-is. The unique `(slug, lang)` constraint already supports per-locale posts.

### API Endpoints

Server fns (created via `createServerFn`) and their HTTP surface (TanStack Start exposes these as serverless function endpoints at predictable URLs, but the route shapes are the visitor-facing contract):

| Method | Route | Handler | Purpose |
|---|---|---|---|
| GET | `/` | `{-$locale}/index.tsx` loader → `getLocalePosts({ data: "en" })` | Render en feed; trigger cookie-first redirect if appropriate |
| GET | `/pt-br/` | `{-$locale}/index.tsx` loader → `getLocalePosts({ data: "pt-br" })` | Render pt-br feed |
| GET | `/<slug>` | `{-$locale}/$slug.tsx` loader → `getPostBySlugWithLang({ data: { slug, lang: "en" } })` | Render en post detail with hreflang pair |
| GET | `/pt-br/<slug>` | `{-$locale}/$slug.tsx` loader → `getPostBySlugWithLang({ data: { slug, lang: "pt-br" } })` | Render pt-br post detail; fall back to en with banner if pt-br missing |
| GET | `/about` | `{-$locale}/about.tsx` loader → `loadAboutFn({ data: "en" })` | Render en About from MDX |
| GET | `/pt-br/about` | `{-$locale}/about.tsx` loader → `loadAboutFn({ data: "pt-br" })` | Render pt-br About from MDX; fall back to en with banner if missing |
| GET | `/robots.txt` | `app/routes/robots[.]txt.ts` | Return static-shape `text/plain` response |

No new POST endpoints. Admin-side `togglePublished` is preserved unchanged. No public mutation surface added in V1.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `app/routes/$lang.tsx` | Renamed → `{-$locale}.tsx` | Layout becomes optional-param-aware. Risk: optional-param API surface drift. | Rename + update param access; smoke test routing. |
| `app/routes/$lang/blog.tsx` | Renamed → `{-$locale}/index.tsx` | Feed moves to locale root. Risk: routeTree regen. | Rename + update imports. |
| `app/routes/$lang/$slug.tsx` | Renamed → `{-$locale}/$slug.tsx` | Path stays semantically same. Low risk. | Rename + update imports. |
| `app/routes/about.tsx` | Replaced | Hardcoded TSX replaced by MDX-driven route. Risk: layout regression. | Delete old; add new `{-$locale}/about.tsx` + `about.server.ts`. |
| `app/routes/{tutorials,projects,newsletter,search,blog,index,$slug}.tsx` | Deleted | Mocked / stub / shim routes removed. Risk: SEO churn on indexed URLs. | Delete files; regenerate `routeTree.gen.ts`. |
| `app/components/tutorial-step.tsx` | Deleted | Orphan after tutorials route removed. | Delete file. |
| `app/components/layout/header.tsx` | Modified | Remove Tutorials/Projects nav; relabel locale switcher to own-language; consume `UIStrings.localeSwitcher.label`. | Update `NAV_LABELS`; wire `strings[locale].localeSwitcher.label`. |
| `app/components/layout/footer.tsx` | Modified | Remove broken `/feed.xml`, `/sitemap.xml` links; remove deleted-route refs; clean up hardcoded PT-BR labels (V1 keeps copy hardcoded per ADR-001). | Update `navLinks`, `resourceLinks` arrays. |
| `app/lib/i18n/strings.ts` | New | Typed UIStrings + Zod schema. Only V1 keys populated. | Create file. |
| `app/lib/mdx/about.server.ts` | New | About loader + Zod schema. | Create file. |
| `content/en/about.mdx`, `content/pt-br/about.mdx` | New | Real About content per locale, indie-dev minimal. | Author content. |
| `content/en/lorem-ipsum.mdx` | Moved → `app/tests/fixtures/lorem-ipsum.mdx` | Test fixture leaves content dir. Risk: stale test references. | `git mv`; update test imports. |
| `app/db/schema.ts`, `app/db/queries.ts`, `app/db/indexer.ts` | Unchanged | About bypasses DB per ADR-006. Posts pipeline unaffected. | None. |
| `vite.config.ts` | Modified | `content-watcher-dev` plugin gains `[sync]` step between seed and watcher spawn. | Add `import { syncAll } from "./app/db/indexer"; await syncAll(...)`. |
| `scripts/deploy.sh` | Modified | Add `docker run ... bun run sync` after migrate, before `docker compose up`. | Edit script; verify on dry-run. |
| `app/routes/robots[.]txt.ts` | New | Static-shape route returning robots content. | Create file. |
| `app/routes/__root.tsx` | Modified (light) | NotFoundComponent copy may consume `UIStrings.notFound.*` once V1 keys ship. Existing hardcoded copy kept per ADR-001 if `notFound` keys remain hardcoded. | Refactor to read from `strings[locale]`. |
| `app/tests/public-routes.test.ts:154`, `app/tests/header.test.ts:149` | Modified | Tests reference `/about`; rewrite for locale-aware About. | Update tests. |
| `package.json` | Modified | Add `zod` dependency. | `bun add zod`. |
| `routeTree.gen.ts` | Regenerated twice | After Phase 1 deletions; after Phase 2 renames. | Verify clean diff after each. |

## Testing Approach

### Unit Tests

**`aboutFrontmatterSchema`** (Phase 3): valid frontmatter parses; missing required `title` throws; invalid `locale` enum throws; empty `links[]` allowed and defaults to `[]`.

**`uiStringsSchema`** (Phase 3): valid `Record<Locale, UIStrings>` parses for both en and pt-br; missing required key on one locale throws at module load.

**`detectLocaleFromRequest`** (Phase 2): cookie=en → returns "en" (no redirect upstream); cookie=pt-br → returns "pt-br"; no cookie + Accept-Language: pt → returns "pt-br"; no cookie + Accept-Language: en → returns "en"; no cookie + no Accept-Language → returns DEFAULT_LOCALE. Existing tests in `app/tests/` may already cover most of this; verify and extend.

**`loadAbout(locale)`** (Phase 3): returns parsed content for existing file; falls back to DEFAULT_LOCALE when locale file missing; throws clear error when both locales missing.

**Cookie-first redirect at `/`** (Phase 2): integration-style test that exercises the `beforeLoad` handler with mock request headers. Asserts 302 response with `Location: /pt-br/` for pt-br Accept-Language. Asserts no redirect for en. Asserts `Vary` header set.

### Integration Tests

**Indexer sync end-to-end** (Phase 1): `syncAll(tempDir)` against a directory with mixed `.mdx` files populates DB rows; rerunning is idempotent; removed files are removed from DB. Existing `app/tests/indexer-integ.test.ts` likely covers this; verify still passes after F9 additions.

**Vite plugin sync step** (Phase 1): boot the dev server in a test harness; assert `[sync]` log line appears between `[seed]` and `[watcher_started]`. May be expensive; prefer unit-test the plugin's sync invocation in isolation.

**Deploy sync step** (Phase 1): unit-test in `scripts/deploy.sh` is awkward in bash; instead, verify post-merge via the smoke-test step at the end of the deploy. Assert `docker run ... bun run sync` exits 0.

**About route end-to-end** (Phase 3): SSR `/about` and `/pt-br/about` against real fixtures; assert frontmatter fields render; assert MDX body present; assert hreflang pairs present.

**Translation fallback for About** (Phase 3): SSR `/pt-br/about` with only `content/en/about.mdx` present; assert en content renders with `lang="en"` attribute and `TranslationNotice` banner.

**Cookie-first redirect end-to-end** (Phase 2): SSR `/` with `Cookie: locale=pt-br` → 302 to `/pt-br/`; SSR `/` with `Accept-Language: pt-BR` no cookie → 302; SSR `/` with cookie=en + Accept-Language: pt-BR → no redirect (cookie wins); SSR `/` no cookie no Accept-Language → no redirect.

### Test infrastructure preserved

- Vitest 4.1.5 runner; tests in `app/tests/**/*.test.ts` per existing config.
- `vi.mock` for filesystem and DB in unit tests; real Postgres in integration tests (CI provides via docker-compose).
- Move `content/en/lorem-ipsum.mdx` to `app/tests/fixtures/lorem-ipsum.mdx`; update mdx-test and indexer-test imports (file paths only).

## Development Sequencing

### Build Order

1. **Phase 1 — Indexer stabilization (F9)**: edit `vite.config.ts` to add the `[sync]` step in `content-watcher-dev` plugin; edit `scripts/deploy.sh` to add a `docker run ... bun run sync` step after migrate. Verify locally that `bun run dev` populates DB rows. No dependencies.
2. **Phase 1 — Footer + header link cleanup (F6)**: edit `app/components/layout/header.tsx` to remove `Tutorials` and `Projects` from `NAV_LABELS`; edit `app/components/layout/footer.tsx` to remove broken `/feed.xml`, `/sitemap.xml` links and references to deleted routes. Depends on step 1 only for the sync-side fix (independent of route changes).
3. **Phase 1 — Delete mock and stub routes (F1)**: delete `app/routes/{tutorials,tutorials.$seriesSlug,projects,newsletter,search}.tsx` and `app/components/tutorial-step.tsx`. Regenerate `routeTree.gen.ts` (auto). Depends on step 2 (the nav cleanup must precede so no nav links target deleted routes during interim builds).
4. **Phase 1 — Ship `/robots.txt` (F7)**: create `app/routes/robots[.]txt.ts` returning the static-shape Response. Depends on no prior step (could land earlier, but kept in Phase 1 sequence for cohesion).
5. **Phase 1 — Fixture move + test rewrites prep (F8 prep)**: `git mv content/en/lorem-ipsum.mdx app/tests/fixtures/lorem-ipsum.mdx`; update test imports for `mdx.test.ts` and `indexer.test.ts`. Depends on step 1 (sync now indexes content/; we want the fixture out of the content/ dir before sync sees it as production content).
6. **Phase 1 ends.** Tag/merge. CI green is the gate.
7. **Phase 2 — Route subtree migration (F2 + F3)**: `git mv app/routes/$lang.tsx app/routes/{-$locale}.tsx`; `git mv app/routes/$lang/blog.tsx app/routes/{-$locale}/index.tsx`; rename co-located `*.server.ts`; `git mv app/routes/$lang/$slug.tsx app/routes/{-$locale}/$slug.tsx`. Update parameter access (e.g., `params.lang` → `params._locale ?? DEFAULT_LOCALE` or whatever the TanStack optional-param API exposes). Regenerate `routeTree.gen.ts`. Delete old top-level shims (`index.tsx`, `blog.tsx`, `$slug.tsx`). Depends on step 6 (Phase 1 merged).
8. **Phase 2 — Cookie-first SSR redirect (ADR-005)**: implement the `beforeLoad` handler in `{-$locale}/index.tsx` (or the parent layout) that calls `detectLocaleFromRequest` and conditionally throws `redirect()`. Add `Vary` header. Add unit tests. Depends on step 7 (route file exists).
9. **Phase 2 — Hreflang on locale-aware pages**: ensure feed root and post detail render `<link rel="alternate" hreflang>` pairs to the matching locale URL. The existing `$slug.tsx:33-46` pattern is the reference. Apply also to feed root. Depends on step 7.
10. **Phase 2 ends.** Tag/merge. CI green is the gate.
11. **Phase 3 — Install Zod**: `bun add zod`. No code-side dependencies. Depends on step 10 (Phase 2 merged).
12. **Phase 3 — UIStrings module**: create `app/lib/i18n/strings.ts` with `uiStringsSchema`, `type UIStrings`, `strings` constant populated with V1-only keys (locale switcher labels in own-language, post meta labels, locale-aware 404 copy). Module-load validation calls `uiStringsSchema.parse` per locale. Depends on step 11.
13. **Phase 3 — Header locale switcher relabel**: edit `header.tsx` to consume `strings[currentLocale].localeSwitcher.label` instead of hardcoded `EN`/`PT`. Depends on step 12.
14. **Phase 3 — `__root.tsx` 404 copy**: refactor `NotFoundPage` to consume `strings[locale].notFound.*`. Depends on step 12.
15. **Phase 3 — About MDX content + schema + loader**: create `content/en/about.mdx` + `content/pt-br/about.mdx` with indie-dev minimal frontmatter (title, locale, optional links). Create `app/lib/mdx/about.server.ts` with `aboutFrontmatterSchema`, `loadAbout`. Create `app/routes/{-$locale}/about.tsx` + `about.server.ts` wiring loader to the component. Add hreflang pair to About route. Depends on step 11 (Zod) and step 7 (route subtree).
16. **Phase 3 — Test rewrites + final fixture verification**: rewrite `public-routes.test.ts:154` and `header.test.ts:149` for locale-aware About routing; verify fixture references all point to `app/tests/fixtures/`. Depends on step 15 (About route exists).
17. **Phase 3 ends.** Tag/merge. CI green is the gate.

### Technical Dependencies

- TanStack Router v1.169+ optional path-param support (current installed version 1.169.1 — satisfied).
- Zod 4.x package (installed in step 11).
- PostgreSQL DB available in CI for integration tests (already provisioned via docker-compose).
- Bun runtime in deploy image (already baked).

## Monitoring and Observability

Key log events to emit (extend the existing structured-JSON pattern from `app/lib/watcher.server.ts`):

| Event | When | Fields |
|---|---|---|
| `sync_started` | Vite plugin `[sync]` step starts; deploy `bun run sync` starts | `contentDir`, `source: "dev" \| "deploy"` |
| `sync_completed` | After `syncAll` returns | `contentDir`, `filesIndexed`, `durationMs` |
| `sync_failed` | `syncAll` throws | `contentDir`, `error.message`, `error.stack` (truncated) |
| `locale_redirect` | Cookie-first SSR redirect fires on `/` | `targetLocale`, `triggeredBy: "cookie" \| "accept-language"` |
| `about_load_failed` | `loadAbout` cannot find any locale file | `requestedLocale`, `attemptedPaths` |
| `about_fallback_used` | `loadAbout` falls back to DEFAULT_LOCALE | `requestedLocale`, `actualLocale: DEFAULT_LOCALE` |

Deploy failure modes:
- `bun run sync` failure during deploy → workflow exits non-zero → `deploy` job fails → app container is NOT restarted → previous version stays serving traffic. This is the intended hard-fail behavior per F9 design.
- `bun run db:migrate` failure → same outcome (existing behavior).

Operational checks (manual, post-Phase 1 deploy):
- Visit `/admin/`. Assert post list is non-empty (if `content/` has any `.mdx`).
- Visit `/robots.txt`. Assert `200` + `text/plain` body.
- `curl -I https://blog/` with no headers → assert no redirect (en default canonical).
- `curl -I -H 'Accept-Language: pt-BR' https://blog/` → assert `302 Location: /pt-br/`.
- `curl -I -H 'Cookie: locale=en' -H 'Accept-Language: pt-BR' https://blog/` → assert no redirect (cookie wins).

## Technical Considerations

### Key Decisions

- **Optional path-param `{-$locale}`** (ADR-004) — chose idiomatic single-route-file pattern over duplicated `/` + `/$lang/*` files. Trade-off: depends on TanStack Router optional-param API stability; mitigated by current v1.169.1 install + official example reference.
- **Cookie-first SSR redirect on `/`** (ADR-005) — chose cookie-precedent redirect over no-redirect or always-Accept-Language. Trade-off: requires `Vary: Cookie, Accept-Language` on `/`; reduces cache hit ratio on the root. Supersedes ADR-001's no-redirect alternative.
- **About served from MDX without DB** (ADR-006) — chose direct file read + render over reusing `posts` table or adding `about_content` table. Trade-off: per-request file read + MDX compile; acceptable for low-volume personal blog; can add per-locale in-memory cache if measured cost matters.
- **Zod for new validation surfaces** (ADR-007) — chose Zod adoption over plain-TS validators or full-project Zod refactor. Trade-off: 12 KB dep + mixed validation styles during V1; mitigated by clear retrofit path in V2.
- **Indexer stabilization in V1 Phase 1** (ADR-003) — chose to fold the F9 fix into V1 over spinning off as separate hotfix. Trade-off: V1 Phase 1 diff grows slightly; mitigated by fix being two small edits.
- **No DB schema migration in V1** — All decisions above preserve `posts` schema; only `routeTree.gen.ts` regenerates. Operational risk: zero schema risk; rollback is "revert merge".

### Known Risks

- **Optional-param API resolution at `/`**. The exact accessor name and resolution semantics for the optional `_locale` param may differ from documentation. Mitigation: prototype during Phase 2 step 7; if blocked, fall back to ADR-004 Alternative 1 (explicit `/` + `/$lang/*` shared component).
- **Cookie-first redirect cache poisoning**. CDNs that ignore `Vary` headers may serve pt-br content to en visitors. Mitigation: `Vary: Cookie, Accept-Language` is mandatory; production CDN must honor it; verify post-Phase 2 via curl-with-headers smoke test.
- **Sync failure on deploy due to malformed `.mdx`**. A bad frontmatter file in `content/` blocks the deploy. Mitigation: pre-merge `bun run sync` smoke pass against current `content/` confirms clean state before Phase 1 ships.
- **Zod bundle leaking to client**. If schemas are imported from client code paths, Zod ships to the browser. Acceptable (it is isomorphic and small); revisit if production bundle size becomes a concern.
- **MDX compile cost on each `/about` request**. Per-request file read + Shiki rendering. Acceptable for V1 traffic; cache by file mtime if measured cost spikes.
- **Phase boundary inconsistency**. After Phase 2, About lives at the legacy `/about` route until Phase 3 lands. Mitigation: Phase 3 lands within days; phase 2 PR description notes the temporary inconsistency.

## Architecture Decision Records

- [ADR-001: V1 Scope for Site Restructure and Organic Content](adrs/adr-001.md) — Accepted typed i18n contract with V1 partial population, free-body About MDX with typed Zod frontmatter, and post-feed home with URL-prefix locale strategy.
- [ADR-002: 3-Phase Rollout for Site Restructure V1](adrs/adr-002.md) — Accepted 3-phase delivery: (1) slim down + stabilize, (2) route restructure, (3) content + i18n contract.
- [ADR-003: Fold Post Indexing Stabilization into V1 Phase 1](adrs/adr-003.md) — Accepted addition of F9 (`bun run sync` in deploy workflow + initial sync at dev boot) to Phase 1 scope.
- [ADR-004: Optional Path-Param `{-$locale}` Routing Primitive](adrs/adr-004.md) — Accepted TanStack Router optional path-param idiom to host `/`, `/pt-br/`, and locale-aware children in one route subtree.
- [ADR-005: Cookie-First SSR Auto-Redirect on `/`](adrs/adr-005.md) — Accepted cookie-first SSR redirect that auto-routes Portuguese browsers to `/pt-br/` on first visit; supersedes ADR-001's no-redirect alternative.
- [ADR-006: About Page Served from MDX Without DB Persistence](adrs/adr-006.md) — Accepted direct MDX file read + render at request time; no `posts.kind` column, no `about_content` table.
- [ADR-007: Adopt Zod as the Project's Validation Primitive](adrs/adr-007.md) — Accepted Zod as the validation primitive for new V1 schemas (UIStrings, About frontmatter); retroactive refactor of inline validators deferred to V2.

