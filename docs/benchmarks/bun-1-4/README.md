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

Run this on a quiet machine. The harness refuses to start above a 1-minute load
average of 2.0 precisely because numbers taken under contention are not worth
publishing. During development of this harness the machine sat at load 28 and
the project's own PGLite test files failed non-deterministically; the same files
passed when run in isolation. That is what contention does to a measurement.

Close other worktrees, dev servers and watchers first.

### Commands

```sh
make bench-setup           # one-time: installs bun 1.3.14 and 1.4.0 into .bench/
docker compose up db -d    # sync, audit-fe and the runtime workload need it
make bench                 # the full matrix
```

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
| `1-minute load average is N, above the 2.0 limit` | Machine is busy | Wait, or pass `--allow-noisy` and treat the numbers as indicative only |
| `Docker is not available` | Docker daemon not running | Start Docker Desktop |
| `The \`db\` container is not running` | Compose service down | `docker compose up db -d` |
| `Port 4174 is already bound by PID N` | Something owns the runtime port | `kill N`, or find it with `lsof -ti tcp:4174` |
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
| Raw results | `docs/benchmarks/bun-1-4/<ISO-date>.json` | yes |
| Rendered comparison | `docs/benchmarks/bun-1-4/REPORT.md` | yes |

Results are committed on purpose. The post cites these numbers, and a reader who
wants to check a claim must be able to open the source data. This is the
opposite of `docs/_reports/`, which is gitignored because audit runs are
transient and per-developer.

A result file is named by date and never overwrites a run from another day.

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
