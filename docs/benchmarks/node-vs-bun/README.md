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

## Test suite — the first comparison was invalid

The first attempt looked like a Bun win and was not one:

| Round | Runtime | Time | Peak RSS | Tests run |
| ----- | ------- | ---- | -------- | --------- |
| 1 | Node 24 | 69.8 s | 3330 MB | 2231 passed |
| 1 | Bun 1.4 | 62.4 s | 2688 MB | 34 failed / 1501 passed |
| 2 | Bun 1.4 | 64.5 s | 2756 MB | 34 failed / 1501 passed |
| 2 | Node 24 | 72.6 s | 3329 MB | 2231 passed |
| 3 | Node 24 | 65.8 s | 3688 MB | 2231 passed |
| 3 | Bun 1.4 | 61.0 s | 2642 MB | 34 failed / 1501 passed |

Bun ran 1587 tests, Node ran 2283. Bun looked faster and lighter because 32 of
124 files never loaded, taking 696 tests with them.

```
ReferenceError: module is not defined
  at node_modules/react/index.js:6
```

### It was a vitest configuration gap, not a Bun incompatibility

One line in `vite.config.ts` makes the whole suite run:

```ts
test: {
  server: { deps: { inline: [/react/, /react-dom/, /zod/] } },
}
```

With it: **124/124 files, 2231 tests pass** — under Bun 1.4.0 *and* under Bun
1.3.14, identically. So this was never a 1.4 improvement and never an upstream
Bun bug; the suite could always have run under Bun with the right config.

### The comparison, with both runtimes running the same 2283 tests

| Round | Runtime | Time | Peak RSS | Load |
| ----- | ------- | ---- | -------- | ---- |
| 1 | Node 24 | 64.8 s | 2980 MB | 11.1 |
| 1 | Bun 1.4 | 62.2 s | 2998 MB | 10.6 |
| 2 | Bun 1.4 | 61.4 s | 2927 MB | 14.4 |
| 2 | Node 24 | 63.7 s | 3379 MB | 8.7 |
| 3 | Node 24 | 62.6 s | 3494 MB | 9.5 |
| 3 | Bun 1.4 | 62.2 s | 2893 MB | 15.2 |

Medians: Node 63.7 s / 3379 MB, Bun 62.2 s / 2927 MB.

**Time is a tie.** 62.2 s against 63.7 s is -2.4%, and the spreads overlap.

**Memory is roughly 10% lower under Bun**, consistent across all three rounds,
and Bun carried the higher load in two of them — which should have hurt it, not
helped. Three samples is too few to publish a precise figure; "consistently a
little lower" is what the data supports.

### The config line costs Node nothing

| Config | Time | Peak RSS |
| ------ | ---- | -------- |
| without inline | 66.1 / 68.2 / 66.6 s | 3532 / 3426 / 3023 MB |
| with inline | 63.1 / 67.0 / 68.6 s | 3710 / 3360 / 4296 MB |

Medians 66.6 s against 67.0 s. Indistinguishable, and the RSS spread is wide
enough on both sides that no difference can be claimed.

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

## What the numbers support

| Front | Node 24 | Bun 1.4 | Verdict |
| ----- | ------- | ------- | ------- |
| `bun install` vs `npm ci` | 8.7 s / 1095 MB | 1.9 s / 57 MB | 4.6x time, 19x memory |
| Test suite, time | 63.7 s | 62.2 s | tie |
| Test suite, memory | 3379 MB | 2927 MB | ~10% lower, consistent |
| Production runtime | cannot run the current bundle | runs it | not comparable |

Install is the only decisive gain, and it needs no runtime migration: `bun
install` works with Node running everything else.

The case for putting tests on Bun is not performance. Today production runs on
Bun and the suite runs on Node 22, so the tests never exercise the runtime that
serves the site. The React CJS failure had been latent the whole time and only
surfaced when Bun was forced.
