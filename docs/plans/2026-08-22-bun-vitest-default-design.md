# Bun + Vitest default runner

> Superseded amendment (2026-08-24): Bun 1.4 + Vitest is the permanent
> runner. Bun Test was retired after two local full-suite signals were roughly
> twice as slow (60.96 vs 119.71 s and 59.56 vs 127.88 s), although inventory,
> skip, and shared-runner differences made both uncontrolled; memory evidence
> was inconclusive and did not justify maintaining the candidate. The
> shadow/cutover portions below are historical rationale, not operational work.

## Goal

Make Bun 1.4 the default runtime for the existing Vitest unit, component, and
integration suite. The measured runtime is tied with Node 24, while Bun reduces
median peak RSS from 3,379 MB to 2,927 MB. Memory is the deciding metric because
multiple worktrees commonly run at the same time.

## Decision

- `test` delegates to `test:vitest:bun`.
- `test:vitest:node` remains an explicit reference and rollback route.
- Bun Test is retired as an executable candidate; its compatibility and
  benchmark evidence remains historical.
- Playwright and dependency installation remain on Bun.
- Build, Biome, and typecheck keep their current commands because no measured
  runtime win justifies changing them.

## CI

The blocking `quality (test)` job uses the Bun installation already shared by
the quality matrix. It no longer installs Node solely for the default Vitest
gate. The former Bun Test shadow job is retired; its retained evidence does
not change.

Historical local verification covered the Bun default, Node fallback, parity,
Bun Test shadow, lint, typecheck, build, test annotation lint, Playwright
through Bun, commit conventions, and the production Docker target.

## Compatibility and rollback

No test is removed. The runtime provenance test adapts its expectations to the
active Vitest runtime, so Bun and Node keep the same blocking inventory. If Bun
+ Vitest regresses, remap `test` to `test:vitest:node` and restore the Node 24
setup in the CI test job. Benchmark history and migrated infrastructure remain
intact.

## Documentation

Rules and benchmark summaries will distinguish three stable roles:

1. Bun + Vitest: blocking default selected for lower memory.
2. Node 24 + Vitest: explicit comparison and rollback reference.
3. Bun Test: retired native-runner candidate; retained only as historical
   evidence.
