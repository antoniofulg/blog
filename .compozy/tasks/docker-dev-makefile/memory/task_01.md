# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot
- Create the root `.dockerignore` exactly from the TechSpec `.dockerignore` pattern list, preserving `.env.example` via negation.

## Important Decisions
- Kept scope limited to `.dockerignore`; did not create `Dockerfile` because that is task_02.

## Learnings
- Pre-change `docker build -t blog-test .` is blocked before context validation because the repository has no `Dockerfile` yet: Docker reports `open Dockerfile: no such file or directory`.
- Context size measured via `printf 'FROM scratch\nCOPY . /ctx\n' | DOCKER_BUILDKIT=1 docker build --progress=plain -f - .`: reported **54.47kB** transferred (well under 5MB threshold). Without `.dockerignore`, source tree is ~486MB (node_modules 476MB + .git 5.6MB).
- Full image-layer check (no `node_modules` in `/app`) cannot run until task_02 creates `Dockerfile`.
- Unit test file created at `app/tests/dockerignore.test.ts` with 9 passing tests.

## Files / Surfaces
- `.dockerignore`
- `app/tests/dockerignore.test.ts`

## Errors / Corrections
- Integration image-layer test blocked: needs Dockerfile from task_02.

## Status
- **DONE**. All unit tests pass (9/9). Context size verified (54.47kB < 5MB). Task file and master tasks updated.

## Ready for Next Run
- Re-run Docker image-layer check after task_02 adds `Dockerfile`: `docker build -t blog-test . && docker run --rm blog-test ls /app/node_modules` should fail (dir absent).
