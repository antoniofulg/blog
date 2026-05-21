# Posts Publish Refactor — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Drop `isPublished` column (Drizzle migration + schema) | done | medium | — |
| 02 | Remove `isPublished` filters across queries / routes / site-model / indexer | done | medium | task_01 |
| 03 | Add `pages.server.ts` module (load / hasTwin / enumerate) | done | medium | — |
| 04 | Migrate `about.mdx` + delete legacy `about` route and loader | done | low | task_03 |
| 05 | Unify `$slug.tsx` loader (post → page → 404) | done | medium | task_02, task_03, task_04 |
| 06 | Content-audit: add `slug-collision` finding + page enumeration | done | low | task_03 |
| 07 | Add `@radix-ui/react-dialog` + `dialog.tsx` wrapper | done | low | — |
| 08 | Create `missing-twin-dialog.tsx` | complete | low | task_07 |
| 09 | Add `RouteKind` + `getTwinAvailabilityForCurrentRoute` + per-item `available` state in language menu | complete | medium | task_03 |
| 10 | Rewrite `useLangSwitcher` + e2e flow tests | complete | high | task_08, task_09 |
| 11 | `/sitemap.xml` route + `getSitemapEntriesFn` + reciprocity unit test | done | medium | task_02, task_03 |
| 12 | Hreflang emission in `buildLocaleHead` (only when twin exists) | done | low | task_02, task_03 |
| 13 | Trim admin: drop publish toggle + delete preview routes + add locale filter + view-in-new-tab | done | medium | task_02 |
| 14 | Update CONTENT.md (file-presence semantics + pages convention) | done | low | — |
