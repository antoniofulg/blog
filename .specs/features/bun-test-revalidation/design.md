# Bun Test Revalidation Design

**Status**: Approved by autonomous execution authorization (2026-08-24)

## Chosen Approach

Build two independent, first-class suites and use cohort screening before a
long full-suite benchmark. Recover the historical Bun tree as a starting point,
then make it Bun-first according to the current official documentation. Keep
the current Vitest path untouched as the canonical control until evidence is
complete.

### Alternatives considered

| Approach | Decision | Reason |
| --- | --- | --- |
| Only add `--parallel` to the retired script | Rejected | Fast, but preserves historical parity gaps, timeout differences, and questionable ports. |
| One shared suite with runner adapter imports | Rejected | Reduces files but makes neither suite runner-first and can hide semantic differences. |
| Independent trees plus controlled cohort/full benchmarks | Chosen | Highest confidence and lets each runner use native APIs/configuration. |

## Architecture

```text
app/tests/ (Vitest-first) ───────┐
                                ├─ inventory/outcome gate ── benchmark harness
app/tests-bun/ (Bun-first) ─────┘                              │
                                                               ├─ raw JSON
                                                               ├─ Markdown summary
                                                               └─ final decision

candidate cohorts
├─ pure
├─ dom
├─ mocks-timers
└─ integration-infra
```

## Suite Design

### Vitest-first tree

`app/tests/` remains authoritative for product-test inventory. Existing jsdom
directives, Vitest mocks, snapshots, hooks and fixtures remain native to
Vitest. Controlled scripts add worker bounds without changing the normal
`test` command.

### Bun-first tree

`app/tests-bun/` mirrors product tests and uses imports from `bun:test`. The
historical tree is restored from `711f18d`, but every file is rechecked against
the current canonical source before it can count as equivalent.

DOM-bearing files import a scoped Happy DOM helper. The helper preserves Bun's
native `Request`, `Response`, and `Headers`, registers missing browser globals,
and supplies deterministic cleanup. Server/integration files do not load it.

Mocks use native `mock`, `spyOn`, and `jest` compatibility APIs as documented.
Module mocks are registered before imports whose side effects must be avoided.
Every file that changes mocks, timers, time zones, environment, DOM, filesystem,
database or subprocess state owns cleanup in its hooks.

## Inventory and Outcome Gate

The parity layer emits a deterministic manifest for both trees:

```ts
type TestManifestEntry = {
  relativePath: string;
  leafTests: string[];
  assertionCount: number;
  fixtures: string[];
  disposition?: { reason: string; evidence: string };
};
```

Static parity is necessary but not sufficient. Runtime summaries must also
match passed, failed, skipped, todo, files and leaf-test identities. A report
with a mismatch is compatibility evidence, never a performance winner.

## Profile Screening

1. Generate per-file timings and classify the canonical inventory.
2. Select representative light, medium and heavy files from each cohort.
3. Run correctness/leak probes:
   - normal order;
   - reversed order;
   - randomized order with recorded seed;
   - immediate rerun in the same profile.
4. Screen `parity-1`, `isolated-2`, and `isolated-4` for both runners.
5. Screen Bun `shared-N` only on cohorts that pass all state probes.
6. Screen `--smol` on the best safe Bun profile.
7. Promote non-dominated valid profiles to full-suite measurement.

Integration files with fixed/shared resources may use a serial cohort even if
pure/DOM cohorts use bounded parallelism. Such a split is reported honestly;
the full package route must remain deterministic and simple.

## Benchmark Harness

The harness receives explicit arms and repetitions. It:

- verifies Bun 1.4.0, Vitest 4.1.5, executable paths and commit;
- fixes `TZ=UTC` and sanitized environment;
- runs arms sequentially with rotated ordering;
- performs one unrecorded/discarded warm-up per arm;
- records at least five measured samples for finalists;
- samples the complete process tree to aggregate peak RSS;
- captures load average before/after each arm;
- parses stable runner summaries and leaf-test inventories;
- records exclusions with reasons instead of deleting samples;
- writes unique raw JSON and derived Markdown.

The report contains cold/warm context, median, min/max or interquartile spread,
peak RSS, compatibility status and maintenance notes. It separates:

1. matched worker/isolation profiles;
2. each runner's best valid safe profile;
3. current operational `test` and one-worker `test:local` experience.

## Timeout Semantics

Vitest retains its 30-second test and 60-second hook timeouts. Bun tests use
explicit per-test/hook timeouts where required rather than one blanket timeout
that changes semantics. Benchmark watchdog timeouts are process-level safety
limits and are recorded separately.

## Coverage and Reporters

The project has no active coverage threshold. Coverage is therefore a separate
capability check, not part of timed runs. Bun must successfully emit LCOV and
JUnit on a representative compatible cohort before any future CI proposal.
Timed runs use concise console output to reduce reporter overhead consistently.

## Decision Output

The final report answers:

1. Did Bun Test achieve equivalent behavior?
2. Which configuration is best for one active worktree?
3. Which configuration minimizes peak memory across several worktrees?
4. Does a speed advantage survive warm-up and repeated interleaved samples?
5. What maintenance cost comes from a second tree?
6. Should AD-004 remain active, be narrowed, or be superseded?

No package default or CI workflow changes during this experiment. Those are a
separate follow-up only if the evidence supports them.

