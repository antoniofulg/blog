# Bun-first test suite

This directory is the native `bun:test` candidate tree for the revalidation
experiment. It was recovered from `711f18d` and contains 113 product-test
files plus the shared fixtures. The canonical Vitest tree remains under
`app/tests/` and is not replaced by this experiment.

The following historical files are intentionally excluded from this candidate
because they exercise benchmark, parity, or Bun Test shadow infrastructure
rather than product behavior:

- `bench-*.test.ts`
- `ci-bun-test-shadow.test.ts`
- `test-bench-*.test.ts`
- `test-migration-cohorts.test.ts`
- `test-migration-parity.test.ts`
- `hook-timeout-diagnostics.test.ts`
- `pilot-vitest.test.tsx`
- `test-runtime.test.ts`
- `test-scripts.test.ts`
- `write-shadow-result.test.ts`

The current canonical inventory has 132 test files. The parity phase records
the 19-file infrastructure disposition before any performance result is
considered valid.

Representative smoke command:

```sh
TZ=UTC bun test app/tests-bun/analytics-device-detector.test.ts --isolate
```

## Native semantics audit

The candidate uses Bun's native `mock.module`, `jest` compatibility mocks and
spies exposed by `bun:test`. The current inventory contains 51 module-mock
files, 13 spy-bearing files and 4 fake-timer files. Mocked imports are either
registered before the module under test is dynamically imported or intentionally
load a pure helper first to capture its real implementation. Mock state,
spies and fake timers are restored in file/describe cleanup hooks or in
`try`/`finally` blocks.

The isolated full suite was run in normal, repeated and reverse file order.
Each run produced 2,057 passed, 101 environment-gated skips and 0 failures
across 113 files. Resource-heavy files use explicit teardown for PGLite,
temporary directories, ports, subprocesses, environment variables and
database advisory locks. These files remain isolated-only until the later
no-isolate leak probes prove otherwise.
