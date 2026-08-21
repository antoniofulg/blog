# Bun 1.3.14 vs 1.4.0 — benchmark

Measures this repository's own pipeline and its production runtime under both
Bun versions, so the upgrade decision and the post that follows rest on numbers
from this codebase rather than on upstream release-note claims.

---

## Where Bun keeps its install store

Both compared versions extract packages into `BUN_INSTALL_CACHE_DIR`. Neither
reads from nor writes to the developer's global `~/.bun/install` when that
variable is set. This matters because Bun 1.4 advertises a global virtual
store: if that store lived outside the redirected cache, a "cold" 1.4 install
would still be warm and the headline install comparison would be unfair.

Probe used, run once per version against a throwaway project:

```sh
mkdir -p /tmp/probe/{proj,cache} && cd /tmp/probe/proj
echo '{ "name": "probe", "dependencies": { "is-odd": "3.0.1" } }' > package.json
du -sk "$HOME/.bun/install"                       # before
BUN_INSTALL_CACHE_DIR=/tmp/probe/cache \
  <repo>/.bench/bun-<version>/bin/bun install
find /tmp/probe/cache -maxdepth 1                 # what appeared
du -sk "$HOME/.bun/install"                       # after — must be unchanged
```

Observed on 2026-08-20, macOS, both versions:

```
/tmp/probe/cache/is-odd@3.0.1@@@1        <- extracted package (the store)
/tmp/probe/cache/is-odd/3.0.1@@@1        <- version index
/tmp/probe/cache/11e2af7323ef853b.npm    <- manifest cache
```

`~/.bun/install` measured 147848 KB before and 147848 KB after, under both
versions. No new directory appeared in it.

**Consequence:** clearing `BUN_INSTALL_CACHE_DIR` is sufficient to make
`install-cold` genuinely cold. The `rm-install-cache` prepare step already
resolves to exactly that directory, so no extra step is needed. A test in
`app/tests/bench-store.test.ts` pins this equivalence, so the two cannot drift
apart silently.

Re-run the probe when bumping to a Bun version newer than 1.4.0. The store
layout is an implementation detail and upstream can move it.

---

## Run playbook

### Before you start

Run this on a quiet machine. The harness refuses to start when the 1-minute load
average exceeds 0.25 per core — about 2.75 on an 11-core machine — because
numbers taken under contention are not worth publishing.

**Contention breaks the test suites before it distorts the numbers.** Both the
Playwright and the Vitest integration suites run PGLite, an in-process Postgres
that competes for the same cores as everything else. Measured on this machine:

| Condition | Playwright suite |
| --------- | ---------------- |
| load ~1 (quiet) | 49/49 passed, six runs in a row |
| load ~9-13 (nine busy loops) | one to two failures per run |

The failing test is not stable across runs. At one load level it was the locale
switcher; at another, `analytics-referrer.spec.ts:283`, with the server logging
`analytics_record_failed` on a `view_count` update. The Vitest side fails the
same way, as `Hook timed out in 10000ms` inside `createTestDb()`.

This was investigated twice. A proposed hydration-race fix was tested against a
no-fix control under identical load and made no difference (2 pass / 2 fail in
both arms), so there is no application bug behind it.

It is also not a Bun 1.4 regression. Running the same bundle and the same
`node_modules` under each version — the only variable being which `bun`
executes the server, and therefore PGLite — with the arms interleaved to cancel
ambient load drift:

| Version | Result (4 runs each, load 22-38) |
| ------- | -------------------------------- |
| 1.3.14 | 1 passed / 3 failed |
| 1.4.0 | 2 passed / 2 failed |

Both versions fail under contention. Four samples per arm cannot separate 3
failures from 2, so this says only that neither version is reliable under this
load — not that either is worse.

A first attempt at this comparison ran the versions in blocks rather than
interleaved, and produced the opposite-looking result (1.3.14 failing 2 of 3,
1.4.0 passing 3 of 3). That was an artefact: ambient load was decaying, the
1.3.14 arm ran first on the busier machine, and its runs took 31-37 s against
17 s for the arm that followed. Interleaving is what removes that.

Why any of this matters for the benchmark: a workload that exits non-zero is
recorded as a `compat` finding against a Bun version. Run `test` or `test-e2e`
on a loaded machine and the report will blame Bun for a busy laptop.

Containers count. A stopped-looking Docker fleet still burns CPU: two idle
Supabase stacks plus a few worker containers were enough to hold this machine
around load 7. `docker compose stop` in the other projects is usually the
single biggest win before a run. During development of this harness the machine sat at load 28 and
the project's own PGLite test files failed non-deterministically; the same files
passed when run in isolation. That is what contention does to a measurement.

Close other worktrees, dev servers and watchers first.

### Commands

```sh
make bench-setup           # one-time: installs bun 1.3.14 and 1.4.0 into .bench/
docker compose up db -d    # sync, audit-fe and the runtime workload need it
make bench                 # the full matrix
```

### Port conflicts with other projects

Both ports this stack needs can be moved, so a benchmark run does not require
shutting down everything else on the machine.

**Postgres.** `docker compose up db -d` fails when another project already
publishes on 5432:

```
Bind for 127.0.0.1:5432 failed: port is already allocated
```

Set `POSTGRES_PORT` in `.env` to a free port and use the same port in
`DATABASE_URL`. Both must agree; preflight aborts when they do not, and also
when `DATABASE_URL` reaches a database that has no `posts` table — which is what
happens when it lands on another project's Postgres.

```sh
# .env
POSTGRES_PORT=5442
DATABASE_URL=postgres://<user>:<password>@localhost:5442/<db>
```

That check exists for a specific reason: without it, a wrong connection string
fails partway through the matrix, gets recorded as a `compat` finding, and a
database misconfiguration ends up published as a Bun compatibility result.

**The runtime server.** The harness binds a free ephemeral port for each boot,
so it never collides with anything. Pin one with `--runtime-port=4200` if you
want a predictable port; a pinned port that is already taken aborts preflight
naming the owning PID.

Note also that `app/tests/lang-slug-route.test.ts` and
`app/tests/audit-content-cli.test.ts` gate on port 5432 being *occupied*
(`describe.skipIf(port5432Free)`). With another project's Postgres on 5432 those
suites will try to run against it. Moving the blog to its own port makes them
skip instead, which is the safer outcome.

Useful subsets while checking the harness itself:

```sh
bun run bench --only=lint                     # one fast workload, both versions
bun run bench --only=runtime --versions=1.4.0 # runtime only, one version
bun run bench --allow-noisy --only=lint       # measure anyway on a busy machine
bun run bench --report-only=docs/benchmarks/bun-1-4/2026-08-20.json
```

### How long it takes

Budget about 90 minutes for the full two-version matrix. Every workload runs one
discarded warm-up plus its timed repetitions, so a workload with 5 reps executes
6 times per version.

Single-run timings measured on this machine give the shape of the cost:

| Workload | One run | Dominates the total? |
| -------- | ------- | -------------------- |
| `lint` | ~0.2 s | no |
| `install-warm` | ~0.3 s with the store warm | no |
| `build` | ~5.6 s | no |
| `check` | ~7 s | no |
| `sync` | seconds | no |
| `install-cold` | tens of seconds | somewhat |
| `test` | ~60 s | yes |
| `test-e2e` | minutes, plus a preparatory build per version | yes |
| `audit-fe` | minutes, boots a preview server per run | yes |

To get a first signal in a few minutes rather than an hour, run
`bun run bench --only=lint,check,build,install-warm` and leave the three heavy
workloads for a full session.

### Preflight aborts and what they mean

| Message | Cause | Remedy |
| ------- | ----- | ------ |
| `bun X is not installed at .bench/...` | Toolchain missing | Run the `curl` line the message prints, or `make bench-setup` |
| `... reports X, expected Y` | Toolchain is the wrong version | Delete that `.bench/bun-*` directory and re-run `make bench-setup` |
| `1-minute load average is N on C cores` | Machine is busy | Close what you can and retry, or pass `--allow-noisy` and treat the numbers as indicative only |
| `Docker is not available` | Docker daemon not running | Start Docker Desktop |
| `The \`db\` container is not running` | Compose service down | `docker compose up db -d` |
| `Port N is already bound by PID M` | A pinned runtime port is taken | Drop `--runtime-port` to let the harness pick a free one, or `kill M` |
| `DATABASE_URL does not connect` | Port or credentials mismatch | Align `POSTGRES_PORT` in `.env` with the port in `DATABASE_URL` |
| `DATABASE_URL reaches database "X", which has no posts table` | Another project's Postgres is on that port | Move the blog to its own `POSTGRES_PORT` |
| `No published pt-br post with an English twin was found` | Content changed | Publish a pt-br twin, or drop `runtime` from `--only` |

### If the run is interrupted

Ctrl+C is safe. The harness flushes whatever it has measured so far to the
result file, then reinstalls `node_modules` with your default `bun` — the one on
`PATH` before the run started. The same restore runs after a crash and after a
normal finish, because the matrix installs dependencies with whichever version
it is measuring and must not leave your tree that way.

If a run is killed hard enough to skip the restore (`kill -9`), run
`bun install --frozen-lockfile` yourself.

### Output

| Artifact | Path | Committed |
| -------- | ---- | --------- |
| Raw results | `docs/benchmarks/bun-1-4/<ISO-timestamp>.json` | yes |
| Rendered comparison | `docs/benchmarks/bun-1-4/<ISO-timestamp>.md` | yes |
| Cross-run index | `docs/benchmarks/bun-1-4/ALL-RUNS.md` | yes |

Results are committed on purpose. The post cites these numbers, and a reader who
wants to check a claim must be able to open the source data. This is the
opposite of `docs/_reports/`, which is gitignored because audit runs are
transient and per-developer.

**The run dirties the working tree — do not `git add -A` afterwards.**
`sync` regenerates OG cards and `audit-fe` appends a row to
`docs/audits/SUMMARY.md`, and the benchmark runs each of them twelve times. A
full run therefore leaves modified PNGs under `public/og/` and twelve bogus
audit rows in a committed, append-only history file.

Commit the results by explicit path, then discard the rest:

```sh
git add docs/benchmarks/            # never `git add -A` here
git checkout -- public/og docs/audits/SUMMARY.md
```

**Nothing is overwritten.** Every run writes its own timestamped JSON and its
own timestamped markdown report, so running subsets across several sessions
leaves every measurement on disk. To re-render an older run:

```sh
bun run bench --report-only=docs/benchmarks/bun-1-4/2026-08-20T22-15-48.json
```

**Read `ALL-RUNS.md` before quoting any number.** It is rebuilt after every run
and puts each workload's delta side by side across every run on disk, with the
median load each side was measured under. A single report cannot tell you that
a number failed to hold; this one can, and it already has:

```
| `install-warm`  | -38.0%       | -30.7%       |   <- holds
| `install-cold`  |  -2.3% ~     | +10.5% ~     |   <- reversed sign, not measured
| `test-e2e`      | -10.7% ~     |  +5.7% ~     |   <- reversed sign, not measured
```

Rebuild it without measuring anything:

```sh
bun run bench --summary
```

The harness deliberately does not merge separate runs into one comparison table.
Two runs minutes apart can sit under different load, thermal and power
conditions, which is why each result file records its own `loadAvg1` and power
source. A table combining them would read as one measurement while being
several. For the numbers that go in the post, run the full matrix in one
sitting.

### Limitations the post must repeat

State these in the post itself, not only here.

- **Five samples per workload** (three for `install-cold`), median reported with
  the min-to-max range. Five samples do not support statistical inference. Any
  delta smaller than the run's own spread is reported as `within noise` and must
  not be written up as an improvement.
- **One machine, one run.** This is a single developer laptop under macOS, not a
  controlled benchmark environment. Results describe this repository on this
  hardware.
- **Resident memory is sampled every 100 ms.** Allocation spikes shorter than
  that are missed. The bias is identical for both versions, so the comparison
  holds even though the absolute peak is understated.
- **`build`, `test` and `test-e2e` spend most of their time inside vite, vitest
  and playwright**, not inside Bun. A large delta there is more likely tool
  variance than a runtime improvement; that is what the noise band is for.
- **`test-e2e` timing includes PGLite setup and browser launch.** It is measured
  that way on purpose: it is the number a developer actually waits for.
