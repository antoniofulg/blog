# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot
- Create the root multi-stage Dockerfile for the docker-dev-makefile PRD task 02.
- Pre-change signal: `test -f Dockerfile` returned exit 1; no root Dockerfile existed.

## Important Decisions
- Scope stays limited to Dockerfile plus task tracking/memory; existing task 01 `.dockerignore` remains owned by prior work.

## Learnings
- Docker is available locally (`docker version --format '{{.Server.Version}}'` returned `29.4.1`).
- `.dockerignore` exists and excludes `node_modules`, `.output`, `.env`, `.env.*`, `.git`, and other build noise before builder `COPY . .`.
- Initial `docker build --target builder -t blog-builder .` reached `bun run build` but failed on TanStack Start import protection: `app/routes/login.tsx` imported `#/lib/auth.client` into the server environment.
- Context7 docs for TanStack Start confirm client-only browser work should be wrapped with `createClientOnlyFn` or otherwise split behind a client boundary.
- Final Docker validations passed against rebuilt images: `dev` target, `builder` target, runner build, entrypoint listing, runner `/app` contents, image size, and HTTP 200 smoke test on port 3000.
- `bun run test` remains red on pre-existing/non-task issues after the import-order correction: duplicate `posts_file_path_unique` fixture state in `public-routes.test.ts`, seed exit-code expectations affected by local env, and a React CJS `module is not defined` warning path.

## Files / Surfaces
- Added `Dockerfile` at repository root with named `dev`, `builder`, and `runner` stages.
- Updated `app/routes/login.tsx` so the login submit handler dynamically imports `#/lib/auth.client` inside `createClientOnlyFn`.

## Errors / Corrections
- Root `AGENTS.md` and `CLAUDE.md` files are absent in the checkout; used the prompt-provided AGENTS instructions plus PRD/techspec/ADR files as repository guidance.
- Docker's default credential helper stalled during the first image metadata fetch; using a temporary `DOCKER_CONFIG` allowed public `oven/bun` pulls and builds to proceed.
- Initial `docker build -t blog .` timing command had invalid zsh syntax (`DOCKER_CONFIG=... time ...`); reran with `/usr/bin/time -p env DOCKER_CONFIG=... docker build -t blog .`.

## Ready for Next Run
- Dockerfile task implementation and task-specific Docker validation are complete. Broader `bun run test` failures are recorded above and should not be attributed to the Dockerfile change.
- Fresh verification (2026-05-05): 9/9 unit tests pass; runner image 164MB; `index.mjs` confirmed; no `node_modules` in runner; `/login` returns HTTP 200. Root `/` returns 500 only because DB on host is unreachable from isolated container — expected, resolved by task_03 docker-compose networking. All Docker image builds confirmed present: `blog-dev`, `blog-builder`, `blog`.
