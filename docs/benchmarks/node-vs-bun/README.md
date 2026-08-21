# Node 24 vs Bun 1.4 — what was measured, and what could not be

A home benchmark on a working developer laptop (Apple M3 Pro, 11 cores, 18 GB),
not a controlled environment. Other processes were running throughout; the load
average at each measurement is recorded below. Read the numbers as "what this
machine does on a normal day", not as a clean-room result.

Every comparison alternates the two runtimes (A,B,B,A) so drift in machine
conditions cannot land on one side.

## Dependency install — the one clean win

`npm ci` under Node 24 against `bun install --frozen-lockfile`, both from a
lockfile, `node_modules` deleted before each.

| Round | Runtime | Time | Peak RSS | Load |
| ----- | ------- | ---- | -------- | ---- |
| 1 | npm 11 / Node 24 | 33.4 s | 480 MB | 30.0 |
| 1 | Bun 1.4 | 12.4 s | 165 MB | 26.2 |
| 2 | Bun 1.4 | **1.8 s** | **47 MB** | 24.7 |
| 2 | npm 11 / Node 24 | 8.7 s | 1165 MB | 24.0 |
| 3 | npm 11 / Node 24 | 8.7 s | 1025 MB | 21.3 |
| 3 | Bun 1.4 | **2.0 s** | **67 MB** | 21.2 |

Round 1 warms both caches — ignore it. Steady state, rounds 2 and 3:

| | npm / Node 24 | Bun 1.4 | |
| --- | --- | --- | --- |
| Time | ~8.7 s | ~1.9 s | **4.6x faster** |
| Peak RSS | ~1095 MB | ~57 MB | **19x less memory** |

The memory gap is the one that matters for parallel worktrees: four concurrent
installs are ~4.4 GB under npm against ~230 MB under Bun.

## Test suite — not comparable

| Round | Runtime | Time | Peak RSS | Tests run |
| ----- | ------- | ---- | -------- | --------- |
| 1 | Node 24 | 69.8 s | 3330 MB | 2231 passed |
| 1 | Bun 1.4 | 62.4 s | 2688 MB | 34 failed / 1501 passed |
| 2 | Bun 1.4 | 64.5 s | 2756 MB | 34 failed / 1501 passed |
| 2 | Node 24 | 72.6 s | 3329 MB | 2231 passed |
| 3 | Node 24 | 65.8 s | 3688 MB | 2231 passed |
| 3 | Bun 1.4 | 61.0 s | 2642 MB | 34 failed / 1501 passed |

**Do not quote these as a speed or memory result.** Bun ran 1587 tests, Node ran
2283. The 696 missing tests are the reason Bun looks faster and lighter: 32 of
124 files never load.

Root cause, one incompatibility with 66 symptoms:

```
ReferenceError: module is not defined
  at node_modules/react/index.js:6
```

React ships CommonJS. Vite 8's module runner loads it in an ESM context where
`module` does not exist under Bun. Every test file importing React dies at load
time; Zod then resolves to `undefined`, producing
`TypeError: undefined is not an object (evaluating 'z.object')` downstream.

The 32 files that do not load are every React-touching test: components,
routes, MDX, i18n, analytics widgets. The 34 individual failures concentrate in
`lang-slug-route.test.ts` (23) and `og-slug-route.test.ts` (11).

## Production runtime — not measured

The Nitro bundle is compiled for Bun and calls `Bun.serve()`, so it cannot run
under Node at all:

```
ReferenceError: Bun is not defined
  at BunServer.serve (.output/server/_libs/h3+rou3+srvx.mjs:336)
```

`NITRO_PRESET=node-server` did not change the emitted output. A fair comparison
needs two builds, one per preset; that was not resolved.

## What actually runs under which runtime today

Measured with a probe test reporting `typeof Bun` and `process.execPath`.

| Command | Actually executed by |
| ------- | -------------------- |
| `bun run test` (vitest) | **Node 22.23.1** |
| `bun run build` (vite) | **Node 22.23.1** |
| `bun run check` / `lint` (biome) | **Node 22.23.1** |
| `bun run test:e2e` (playwright) | **Node 22.23.1** |
| `bun run sync`, `audit:fe` (`.ts`) | Bun |
| `bun install` | Bun |
| Production server | Bun |

Everything in `node_modules/.bin` carries `#!/usr/bin/env node`, and `bun run`
honours the shebang. `bun --bun run test` forces Bun instead.

This is why `test`, `build`, `check`, `lint` and `audit-fe` all read `within
noise` when comparing Bun 1.3.14 against 1.4.0: both arms ran the same Node.
That was not an absence of gain, it was an absence of Bun.
