# Bun 1.3.14 vs 1.4.0 — benchmark report

Run started 2026-08-21T05:47:58.884Z on Antonios-MacBook-Pro.local (Apple M3 Pro, 11 cores, 18432.0 MB RAM, power: ac, 1-min load at start: 1.28).

Medians over the timed repetitions, warm-up discarded. A delta smaller than the run's own min-to-max spread is reported as `within noise` and must not be quoted as an improvement. The noise band is computed from timings only, so the RSS columns carry no verdict: read a small memory delta as unresolved, not as change.

## Workloads

| Workload | 1.3.14 median | 1.4.0 median | Time % | Verdict | 1.3.14 peak RSS | 1.4.0 peak RSS | RSS % |
| -------- | -------------- | ------------- | ------ | ------- | ---------------- | --------------- | ----- |
| `install-cold` | 9.57 s | 10.58 s | +10.5% | within noise | 336.4 MB | 240.2 MB | -28.6% |
| `install-warm` | 1.85 s | 1.28 s | -30.7% | faster | 157.9 MB | 54.2 MB | -65.7% |
| `build` | 4.58 s | 4.56 s | -0.3% | within noise | 1100.3 MB | 1127.5 MB | +2.5% |
| `test` | 57.02 s | 56.78 s | -0.4% | within noise | 6364.3 MB | 6131.1 MB | -3.7% |
| `test-e2e` | 11.51 s | n/a | n/a | no result | n/a | n/a | n/a |
| `lint` | 117 ms | 116 ms | -1.3% | within noise | 107.0 MB | 106.2 MB | -0.8% |
| `check` | 3.85 s | 3.88 s | +0.8% | slower | 918.5 MB | 923.7 MB | +0.6% |
| `sync` | 6.34 s | 6.60 s | +4.0% | slower | 643.4 MB | 610.2 MB | -5.2% |
| `audit-fe` | 21.86 s | 21.60 s | -1.2% | faster | 484.8 MB | 453.5 MB | -6.5% |

## Runtime (production bundle)

| Version | Boot | Idle RSS | Peak RSS | Post-load RSS | p50 | p95 | p99 | Requests |
| ------- | ---- | -------- | -------- | ------------- | --- | --- | --- | -------- |
| 1.3.14 | 235 ms | 209.7 MB | 551.8 MB | 551.6 MB | 2.21 s | 3.54 s | 3.79 s | 297 |
| 1.4.0 | 204 ms | 144.3 MB | 559.8 MB | 559.6 MB | 635 ms | 786 ms | 2.45 s | 988 |

Resident memory is sampled every 100 ms, so peaks shorter than that are missed. The bias is identical for both versions.

## Findings

| Workload | Version | Kind | Exit code |
| -------- | ------- | ---- | --------- |
| `test-e2e` | 1.4.0 | compat | 1 |

### `test-e2e` under 1.4.0 (compat)

```
$ playwright test
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22m[0m[31m[2m2026-08-21T06:04:47.542Z[0m [31mERROR[0m [1m[Better Auth]:[0m Invalid password[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
error: script "test:e2e" exited with code 1

```
