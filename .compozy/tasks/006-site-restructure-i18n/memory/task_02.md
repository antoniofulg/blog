# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Remove broken nav/footer links before task_03 deletes the routes. Header: Tutorials + Projects. Footer: /tutorials, /projects, /feed.xml, /sitemap.xml, /newsletter, /search.

## Important Decisions

- Kept `/newsletter` in header NAV_LABELS — task_02 scope only covers Tutorials and Projects removal per explicit requirements. Newsletter removal will happen in task_03 when its route is deleted.
- Kept the `/search` icon link in header body (not part of NAV_LABELS) — outside task_02 scope. Task_03 will need to handle this when deleting the search route.

## Learnings

- Changes were already partially applied before this run — git working tree had staged/unstaged modifications to header.tsx, footer.tsx, header.test.ts, and footer.test.ts was untracked.
- Footer had previously contained: Tutoriais (/tutorials), Projetos (/projects) in navLinks; Newsletter, Sobre, RSS Feed (/feed.xml), Sitemap (/sitemap.xml) in resourceLinks.
- Header had previously contained: Tutorials (/tutorials), Projects (/projects) in en NAV_LABELS; Tutoriais, Projetos in pt-br NAV_LABELS.

## Files / Surfaces

- `app/components/layout/header.tsx` — Tutorials/Projects removed from NAV_LABELS (both locales)
- `app/components/layout/footer.tsx` — navLinks cleaned (removed /tutorials, /projects); resourceLinks cleaned (removed /newsletter, /feed.xml, /sitemap.xml; kept /about)
- `app/tests/header.test.ts` — added "unit: Header removed nav entries" describe block (6 tests)
- `app/tests/footer.test.ts` — new file, 9 tests covering absent entries + valid remaining links

## Errors / Corrections

None. All 22 header+footer tests pass. Pre-existing lint warnings (3) and DB-requiring test failures (14) unchanged.

## Ready for Next Run

Task complete. Task_03 (delete tutorials/projects/newsletter/search routes) can proceed. Note: header still has `/search` icon link and `/newsletter` in NAV_LABELS — task_03 must clean these.
