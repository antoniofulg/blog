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
