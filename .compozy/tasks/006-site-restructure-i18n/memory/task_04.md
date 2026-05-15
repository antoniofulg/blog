# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Ship `app/routes/robots[.]txt.ts` returning a `text/plain` 200 Response with V1 baseline body. Tests for status, content-type, body shape, no Sitemap: directive.

## Important Decisions

- Exported `ROBOTS_BODY` constant and `getRobotsResponse()` function from route file for direct unit testability without complex mocks.
- Mocked `@tanstack/react-router`'s `createFileRoute` in test file so the route module can be imported without triggering TanStack Router internals.
- Updated `routeTree.gen.ts` manually (Biome reformatted imports on save). The Biome auto-organizer renamed `RobotsTxtRouteImport` → `RobotsDottxtRouteImport` (bracket escape → camelCase). This is correct behavior.
- Import order in test file must be alphabetical (Biome `organizeImports`): `{ getRobotsResponse, ROBOTS_BODY }` not `{ ROBOTS_BODY, getRobotsResponse }`.

## Learnings

- `routeTree.gen.ts` must be manually updated when dev server can't run. Add import, route constant, all type interfaces (FileRoutesByFullPath/To/Id, FileRouteTypes unions, RootRouteChildren), FileRoutesByPath declaration, and rootRouteChildren object.
- `biome check .` (used in biome.test.ts) treats import order as an ERROR (not warning), so unsorted imports will fail CI.
- Integration tests (3) correctly skip when port 3000 is free — pattern reused from public-routes.test.ts.

## Files / Surfaces

- `app/routes/robots[.]txt.ts` — new route file
- `app/tests/robots-txt.test.ts` — new test file (10 unit + 3 integration skipped)
- `app/routeTree.gen.ts` — updated to register /robots.txt route

## Errors / Corrections

- TS2345 on `createFileRoute("/robots.txt")` — fixed by updating routeTree.gen.ts to include /robots.txt in FileRoutesByPath
- Biome organizeImports error in test file — fixed by sorting named imports alphabetically

## Ready for Next Run

Task complete. All subtasks done. Route file, tests, lint, typecheck all green.
