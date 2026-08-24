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
