# Site Restructure: Organic Content with Locale Foundation — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Stabilize post indexing pipeline (F9) | complete | medium | — |
| 02 | Clean header + footer broken links | complete | low | — |
| 03 | Delete tutorials, projects, newsletter, search routes | complete | low | task_02 |
| 04 | Ship `/robots.txt` route | complete | low | — |
| 05 | Move lorem-ipsum fixture out of `content/` | complete | low | task_01 |
| 06 | Rename `$lang/*` subtree to `{-$locale}/*` | complete | medium | task_03 |
| 07 | Delete top-level redirect shims | complete | low | task_06 |
| 08 | Implement cookie-first SSR redirect on `/` | complete | medium | task_07 |
| 09 | Add hreflang pairs to locale-aware pages | complete | low | task_07 |
| 10 | Install Zod dependency | complete | low | — |
| 11 | Create typed UIStrings module + Zod schema | complete | medium | task_10 |
| 12 | Wire UIStrings consumers (header + post meta + 404) | complete | medium | task_07, task_11 |
| 13 | Migrate About to MDX-per-locale + tests | complete | high | task_07, task_10 |
