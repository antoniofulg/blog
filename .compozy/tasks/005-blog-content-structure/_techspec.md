---
title: "TASK-0005 TechSpec: Blog Content Structure — Multilingual Schema, Locale Routing & Language Switcher"
slug: 005-blog-content-structure
status: approved
date: 2026-05-07
---

## Executive Summary

This TechSpec translates PRD-0005 into a concrete set of file additions, schema migrations, and route changes. The primary trade-off is the `$lang` layout-route approach: a single TanStack Router dynamic segment captures all locale-prefixed paths, requiring `beforeLoad` validation to reject invalid values, but eliminates route-file duplication for every future locale. The locale preference (localStorage `'locale'` key, defaulting to `'en'`) mirrors the existing `app/lib/theme.tsx` pattern exactly. The translation fallback strategy (two-query loader: try target locale, fall back to available locale with notice) is symmetric — it applies in both directions. Initial locale detection on locale-less entry points uses the `Accept-Language` HTTP header server-side; any `pt-*` value maps to `pt-br`, everything else maps to `en`. View counts are automatically per-language because each `(slug, lang)` row is a separate DB record with its own `viewCount` — no schema change required for that behavior.

No new npm packages are required. All routing is TanStack Router file-based. All persistence is Drizzle + PostgreSQL via an additive migration.

## System Architecture

### Component Overview

```
Content Layer
  content/en/         ← English MDX files
  content/pt-br/      ← Portuguese MDX files

Data Layer
  app/db/schema.ts    ← adds lang, category, series, seriesPart, draft columns; composite unique
  app/db/indexer.ts   ← derives lang from path, reads new frontmatter fields
  app/db/queries.ts   ← adds lang parameter to getPublishedPostsFn
  drizzle/            ← new migration file

Locale State Layer
  app/lib/locale.tsx  ← LocaleProvider, useLocale(), detectLocale(), localStorage persistence
  app/routes/__root.tsx ← wraps app in LocaleProvider

Routing Layer
  app/routes/$lang.tsx        ← layout route; validates $lang param
  app/routes/$lang/blog.tsx   ← /en/blog, /pt-br/blog (locale-filtered listing)
  app/routes/$lang/$slug.tsx  ← /en/$slug, /pt-br/$slug (with fallback rendering)
  app/routes/index.tsx        ← locale detection + redirect to /$lang/blog
  app/routes/blog.tsx         ← locale detection + redirect to /$lang/blog
  app/routes/$slug.tsx        ← locale detection + redirect to /$lang/$slug

UI Layer
  app/components/layout/header.tsx ← adds language switcher button
  app/components/ui/translation-notice.tsx ← "not available in this language" banner

Content Watcher
  scripts/watcher.ts  ← already passes content/ as root; works unchanged
```

Data flow for a post request (symmetric fallback):
1. User visits `/pt-br/react-suspense`
2. `$lang.tsx` `beforeLoad` validates `lang = 'pt-br'`
3. `$lang/$slug.tsx` loader calls `getPostBySlugFn('react-suspense', 'pt-br')`
4. DB: query `(slug='react-suspense', lang='pt-br')` → miss
5. Fallback: query `slug='react-suspense'` across all locales → hit (lang='en')
6. Returns `{ post, notTranslated: true, requestedLang: 'pt-br', availableLang: 'en' }`
7. Component renders English content + `<TranslationNotice lang="en" requestedLang="pt-br" />`

Same flow applies inversely: `/en/<slug>` where only a `pt-br` version exists → serves pt-br content with notice. If no version exists in any locale → 404.

## Implementation Design

### Core Interfaces

#### Locale system (`app/lib/locale.tsx`)

```typescript
type Locale = "en" | "pt-br";

export const LOCALES: Locale[] = ["en", "pt-br"];
export const DEFAULT_LOCALE: Locale = "en";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ children }: { children: React.ReactNode });
export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void };
```

#### Post query with locale (`app/db/queries.ts`)

```typescript
export async function getPublishedPostsFn(lang: Locale): Promise<Post[]>;
// WHERE isPublished = true AND lang = $lang AND draft IS NOT TRUE
// ORDER BY publishedAt DESC
```

#### Post detail loader result (`app/routes/$lang/$slug.tsx`)

```typescript
type PostLoaderResult = {
  post: Post;
  html: string;
  requestedLang: Locale;       // the locale from the URL
  notTranslated: boolean;      // true when serving a different locale as fallback
  availableLang: Locale | null; // the locale actually being served
};
```

Fallback logic is **symmetric**: `/en/<slug>` where no English version exists serves the available locale (e.g., `pt-br`) with a notice. `/pt-br/<slug>` where no Portuguese version exists serves the available locale (e.g., `en`) with a notice. If no version exists in any locale → `notFound()`.

Loader steps:
1. Query `(slug, requestedLang)` → if found, return `{ post, notTranslated: false }`
2. Query `slug` across all locales (`WHERE slug = ? LIMIT 1`) → if found, return `{ post, notTranslated: true, availableLang: post.lang }`
3. If no row found → throw `notFound()`

#### `$lang.tsx` beforeLoad (`app/routes/$lang.tsx`)

```typescript
beforeLoad: ({ params, location }) => {
  if (!LOCALES.includes(params.lang as Locale)) {
    throw redirect({ to: "/en/blog" });
  }
};
```

#### Locale detection utility (`app/lib/locale.tsx`)

```typescript
// Server-side: called in loader/beforeLoad of locale-less entry routes
export function detectLocaleFromRequest(request: Request): Locale {
  const stored = /* read from cookie or session if available */;
  if (stored && LOCALES.includes(stored)) return stored;
  const acceptLang = request.headers.get("Accept-Language") ?? "";
  return /\bpt\b/i.test(acceptLang) ? "pt-br" : DEFAULT_LOCALE;
}
```

`detectLocaleFromRequest` is called in the `loader` (not `beforeLoad`) of `app/routes/index.tsx`, `app/routes/blog.tsx`, and `app/routes/$slug.tsx`. It reads `Accept-Language`, maps any `pt-*` value to `pt-br`, and returns the detected locale. The caller throws a `redirect` to the locale-prefixed URL. localStorage is the client-side fallback; the server signal is used only on the first visit when no preference is stored.

#### View count per language

The `viewCount` column is on the `posts` table. Each `(slug, lang)` row is a distinct DB record with its own `id` and `viewCount`. `incrementViewCountFn` uses `post.id` as the update target — it already increments the correct per-language counter without any code change. No schema modification required.

### Data Models

#### Updated `posts` table

| Column | Type | Constraint | Change |
|---|---|---|---|
| `id` | serial | PK | unchanged |
| `filePath` | text | UNIQUE NOT NULL | unchanged |
| `slug` | text | NOT NULL | remove `UNIQUE`; covered by composite |
| `lang` | text | NOT NULL DEFAULT 'en' | **NEW** |
| `title` | text | NOT NULL | unchanged |
| `description` | text | nullable | unchanged |
| `publishedAt` | timestamp | nullable | unchanged |
| `isPublished` | boolean | default false | unchanged |
| `viewCount` | integer | default 0 | unchanged |
| `indexedAt` | timestamp | default now() | unchanged |
| `category` | text | nullable | **NEW** |
| `series` | text | nullable | **NEW** |
| `seriesPart` | integer | nullable | **NEW** |
| `draft` | boolean | nullable | **NEW** |
| — | — | `UNIQUE(slug, lang)` | **NEW composite** |

#### Drizzle schema additions (`app/db/schema.ts`)

```typescript
export const posts = pgTable("posts", {
  // ... existing columns ...
  lang: text("lang").notNull().default("en"),
  category: text("category"),
  series: text("series"),
  seriesPart: integer("series_part"),
  draft: boolean("draft"),
}, (t) => [
  unique().on(t.slug, t.lang),   // replaces slug unique
]);
```

The `slug` column's standalone `.unique()` call is removed. The composite unique is added via the table-level config.

### API Endpoints

No new external API endpoints. All data access uses TanStack Start server functions.

| Server Function | Change | Description |
|---|---|---|
| `getPublishedPostsFn` | modified | Accepts `lang: Locale`; filters by `lang AND NOT draft` |
| `getPublishedPosts` (server fn wrapper) | modified | Passes `lang` from route param |
| `getPostBySlugFn` | modified | Accepts `(slug, lang)` with English fallback; returns `notTranslated` flag |
| `getAllPostsFn` (admin) | unchanged | Admin sees all posts regardless of lang |

## Integration Points

No external services. The watcher uses `fs.watch` on `content/` recursively — already handles subdirectories correctly when the root is `content/` (not a locale subdir). `scripts/watcher.ts` passes `join(process.cwd(), "content")` unchanged.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `app/db/schema.ts` | modified | Add 4 columns; drop `slug UNIQUE`; add `UNIQUE(slug, lang)` — **breaking** for existing data | Migration required; existing 3 posts assigned `lang='en'` by DEFAULT |
| `drizzle/` | new | New migration file | Run `bun run db:generate` after schema change |
| `app/db/indexer.ts` | modified | `upsertPost` must derive `lang` from filePath; read `category`, `series`, `seriesPart`, `draft`; update conflict target to `filePath` (unchanged) | Medium risk — test with existing 3 posts |
| `app/db/queries.ts` | modified | `getPublishedPostsFn` gains `lang` param | Low risk — only one caller |
| `app/lib/locale.tsx` | new | Locale state provider; mirrors `theme.tsx` | No risk |
| `app/routes/__root.tsx` | modified | Wrap app in `LocaleProvider` | Low risk |
| `app/components/layout/header.tsx` | modified | Add language switcher button | Low risk |
| `app/routes/$lang.tsx` | new | Layout route; validates `$lang` | Medium risk — must not intercept non-locale single-segment paths |
| `app/routes/$lang/blog.tsx` | new | Locale-filtered listing | No risk |
| `app/routes/$lang/$slug.tsx` | new | Post detail with fallback | Medium risk — two-query loader |
| `app/routes/index.tsx` | modified | Locale detection via `Accept-Language` + redirect to `/$lang/blog`; also updates `getPublishedPosts` call to pass `lang` | Low risk |
| `app/routes/blog.tsx` | modified | Locale detection + redirect to `/$lang/blog` | Low risk |
| `app/routes/$slug.tsx` | modified | Locale detection + redirect to `/$lang/$slug` | Low risk |
| `content/` → `content/en/` | restructured | 3 existing files move to `content/en/`; add `content/pt-br/.gitkeep` | Re-index required after move |
| `app/components/ui/translation-notice.tsx` | new | Banner shown on English fallback | No risk |
| `.agents/rules/git-workflow.md` | modified | Add `post/<lang>/<slug>` branch pattern | No risk |
| `CONTENT.md` | new | Conventions document | No risk |
| `app/tests/` | modified | Frontmatter lint test; update route tests for new structure | Medium risk — existing route tests reference old slug path |

## Testing Approach

### Unit Tests

- **`app/lib/locale.tsx`:** localStorage read/write, default to `'en'`, setLocale persists and notifies; `detectLocaleFromRequest` with `Accept-Language: pt-BR,pt;q=0.9` → `'pt-br'`; `Accept-Language: en-US,en` → `'en'`; missing header → `'en'`
- **`app/db/indexer.ts`:** `upsertPost` with `content/en/file.mdx` → `lang='en'`; `content/pt-br/file.mdx` → `lang='pt-br'`; `category` read and persisted; unknown category value stored (enforcement is in lint, not indexer)
- **`app/db/queries.ts`:** `getPublishedPostsFn('en')` filters by `lang='en'` and `draft IS NOT TRUE`
- **Frontmatter lint (`app/tests/mdx.test.ts`):** required fields present; category from controlled list; series+seriesPart co-present; missing title throws

### Integration Tests

- **`$lang.tsx` beforeLoad:** `/invalid/blog` redirects to `/en/blog`; `/en/blog` passes
- **`$lang/$slug.tsx` loader:** `(slug='react-suspense', lang='pt-br')` with no pt-br row but en row exists → returns English post with `notTranslated: true`; `(slug='react-suspense', lang='en')` with no en row but pt-br row exists → returns pt-br post with `notTranslated: true`; missing slug in all locales → 404
- **`/blog` redirect:** `Accept-Language: pt-BR` → redirects to `/pt-br/blog`; `Accept-Language: en-US` → redirects to `/en/blog`
- **`/` (home) redirect:** `Accept-Language: pt-BR` → redirects to `/pt-br/blog`; no header → redirects to `/en/blog`
- **Indexer re-index after file move:** existing 3 posts at `content/en/` index correctly with `lang='en'`, filePath updated
- **View count separation:** incrementing view count on `/en/react-suspense` does not affect `viewCount` on `/pt-br/react-suspense` (separate DB rows, separate `id` values)

## Development Sequencing

### Build Order

1. **Update `app/db/schema.ts`** — no dependencies; add `lang`, `category`, `series`, `seriesPart`, `draft` columns; replace `slug UNIQUE` with `UNIQUE(slug, lang)`

2. **Generate and apply Drizzle migration** — depends on step 1; run `bun run db:generate` then `bun run db:migrate`; existing 3 posts get `lang='en'` via DEFAULT

3. **Move `content/*.mdx` → `content/en/`; add `content/pt-br/.gitkeep`** — depends on step 2; existing filePaths in DB become stale → trigger re-index in step 5

4. **Update `app/db/indexer.ts`** — depends on steps 1-3; add `lang` derivation from path (`content/en/` → `'en'`), read `category`/`series`/`seriesPart`/`draft` from frontmatter; update `syncAll` test path to `content/` parent

5. **Run `syncAll('content/')` or re-index** — depends on step 4; re-indexes all 3 moved posts with correct `lang='en'` and updated `filePath`; verify with `SELECT * FROM posts`

6. **Update `app/db/queries.ts`** — depends on step 1; add `lang` param to `getPublishedPostsFn`

7. **Create `app/lib/locale.tsx`** — no dependencies on previous steps; `LocaleProvider`, `useLocale()`, localStorage `'locale'` key, and `detectLocaleFromRequest(request: Request): Locale` using `Accept-Language` header parsing

8. **Update `app/routes/__root.tsx`** — depends on step 7; wrap `ThemeProvider` + children in `LocaleProvider`

9. **Create `app/routes/$lang.tsx`** — depends on step 7; layout route with `beforeLoad` that validates `$lang` against `LOCALES`

10. **Create `app/routes/$lang/blog.tsx`** — depends on steps 6, 9; locale-filtered listing page calling `getPublishedPostsFn($lang)`

11. **Create `app/routes/$lang/$slug.tsx`** — depends on steps 6, 9; two-query loader: try `(slug, lang)`, fall back to `(slug, 'en')`, set `notTranslated`

12. **Create `app/components/ui/translation-notice.tsx`** — no dependencies; renders a symmetric notice: "this post is not yet available in [requested language] — showing [available language] version"; rendered by `$lang/$slug.tsx` when `notTranslated = true`; receives `requestedLang` and `availableLang` props

13. **Update `app/routes/index.tsx`** — depends on step 7; call `detectLocaleFromRequest(getRequest())` in the `loader`; throw `redirect({ to: '/$lang/blog', params: { lang } })`; home page becomes a locale-detect-and-redirect entry point

14. **Update `app/routes/blog.tsx`** — depends on step 7; same locale detection + redirect as step 13

15. **Update `app/routes/$slug.tsx`** — depends on step 7; locale detection + redirect preserving `$slug` in the redirect target

16. **Update `app/components/layout/header.tsx`** — depends on step 7; add language switcher button that calls `setLocale()` and navigates to the locale-prefixed equivalent of the current URL

17. **Add `post/<lang>/<slug>` to `.agents/rules/git-workflow.md`** — no dependencies

18. **Create `CONTENT.md`** — depends on steps 1-17 (documents actual implemented conventions)

19. **Update frontmatter lint test** — depends on steps 3-4; update paths to `content/en/**`; add category list check; add series+seriesPart co-presence check

20. **Run `make test`** — depends on all previous steps; must exit 0

### Technical Dependencies

- Drizzle migration must apply before any indexer or query code runs against the new columns
- Content file move (step 3) must happen before re-index (step 5) so filePaths in DB are correct
- `$lang.tsx` layout route must be created before child routes — TanStack Router requires the layout to exist for nesting to work
- `routeTree.gen.ts` is auto-regenerated by the TanStack Router Vite plugin on dev server start or `bunx tsr generate`

## Monitoring and Observability

The indexer already logs structured JSON (`{ level, action, filePath, slug }`). Two new log fields required:

- `lang` — added to every `indexed` and `index_error` log entry
- `category` — added to `indexed` log entry (null when not set)

Example: `{ "level": "INFO", "action": "indexed", "filePath": "content/en/react-suspense.mdx", "slug": "react-suspense", "lang": "en", "category": "frontend" }`

No alerting changes needed.

## Technical Considerations

### Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `$lang` dynamic segment intercepts non-locale paths | Medium | `beforeLoad` redirects any `$lang` value not in `LOCALES` to `/en/blog`; existing routes under `/__root` that don't conflict are unaffected |
| Client-side redirect in `blog.tsx` and `$slug.tsx` causes flash before redirect | Low | Standard TanStack Router redirect in `loader` runs before render; no visible flash |
| Existing tests reference `/blog` or `/$slug` paths directly | Medium | Update test fixtures to use `/en/blog` and `/en/$slug`; old route tests become redirect-assertion tests |
| `content/en/` move breaks indexer if contentDir passed as `content/en/` instead of `content/` | Medium | Confirm `scripts/watcher.ts` passes `join(process.cwd(), "content")` (already does); `syncAll` called with `content/` parent ensures both locale dirs are covered |
| Series/seriesPart column: `seriesPart` without `series` or vice versa | Low | Frontmatter lint test (step 19) blocks PRs where one is set without the other |
| Brazilian developer using English-language Chrome gets `en` on first visit | Medium | Accept-Language reflects browser language, not country. User must switch once manually; localStorage persists their choice thereafter. Country-based geolocation is a V2 option (ADR-005) |

## Architecture Decision Records

- [ADR-001: V1 scope — conventions + DB schema, no UI filtering](adrs/adr-001.md) — established initial data-foundation-only scope (from idea phase)
- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md) — all changes in one PR; avoids interim broken state
- [ADR-003: Expand V1 scope to include locale routing and language switcher](adrs/adr-003.md) — routing added to make bilingual publishing functional end-to-end
- [ADR-004: Technical architecture — `$lang` layout route, localStorage locale, English fallback rendering](adrs/adr-004.md) — layout route over flat file duplication; localStorage mirrors theme pattern; two-query fallback prevents dead ends
- [ADR-005: Initial locale detection — Accept-Language header + Portuguese country mapping](adrs/adr-005.md) — server-side header parsing over IP geolocation API; zero external dependencies; pt-* header value maps to pt-br
