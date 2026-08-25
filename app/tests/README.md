# Bun Test suite

This is the canonical native `bun:test` tree. It contains 113 product tests
and 20 infrastructure/runner tests, for 133 test files total. Shared fixtures
remain under `app/tests/fixtures/`.

Run the measured default profile:

```sh
bun run test
```

The command pins Bun 1.4.0, uses `TZ=UTC`, and starts two isolated workers.
Pure tests do not pay for a DOM environment. Component tests import
`./happydom` selectively; that setup registers HappyDOM, preserves Bun-native
`Request` and `Headers`, installs the missing browser shims, and cleans the
document after each test.

The suite uses Bun-native `mock.module`, Jest-compatible mocks and spies from
`bun:test`, and explicit cleanup for mocks, timers, PGLite, temporary files,
ports, subprocesses, environment variables, and database advisory locks.

Real-browser flows remain in `tests/e2e/` and run through Playwright. The local
Bun.WebView harness covers only the five anonymous public-route diagnostics;
it is not part of this suite or blocking CI.
