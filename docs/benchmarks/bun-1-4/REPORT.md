# Bun 1.3.14 vs 1.4.0 — benchmark report

Run started 2026-08-21T16:25:16.020Z on Antonios-MacBook-Pro.local (Apple M3 Pro, 11 cores, 18432.0 MB RAM, power: ac, 1-min load at start: 10.54).

Medians over the timed repetitions, warm-up discarded. A delta smaller than the run's own min-to-max spread is reported as `within noise` and must not be quoted as an improvement. The noise band is computed from timings only, so the RSS columns carry no verdict: read a small memory delta as unresolved, not as change.

## Workloads

| Workload | 1.3.14 median | 1.4.0 median | Time % | Verdict | 1.3.14 peak RSS | 1.4.0 peak RSS | RSS % |
| -------- | -------------- | ------------- | ------ | ------- | ---------------- | --------------- | ----- |
| `test` | 62.23 s | 62.57 s | +0.6% | within noise | 3292.1 MB | 3113.3 MB | -5.4% |
| `test-e2e` | 12.43 s | 13.14 s | +5.7% | within noise | 584.5 MB | 491.8 MB | -15.9% |

## Findings

| Workload | Version | Kind | Exit code | Failed reps |
| -------- | ------- | ---- | --------- | ----------- |
| `test-e2e` | 1.4.0 | compat | 1 | 3 of 6 |
| `test-e2e` | 1.3.14 | compat | 1 | 1 of 6 |

A workload that fails a few of its repetitions is flaky; one that fails all of them is incompatible. The ratio is what separates them — a bare failure count cannot.

### `test-e2e` under 1.4.0 (compat)

```
$ playwright test
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22m[0m[31m[2m2026-08-21T16:38:20.780Z[0m [31mERROR[0m [1m[Better Auth]:[0m Invalid password[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
error: script "test:e2e" exited with code 1

```

### `test-e2e` under 1.3.14 (compat)

```
[2m[WebServer] [22m[0m
[1A[2K[2m[WebServer] [22m[0m[31m{"event":"analytics_record_failed","postId":4,"error":"Failed query: update \"posts\" set \"view_count\" = view_count + 1 where \"posts\".\"id\" = $1\nparams: 4"}[0m
[1A[2K[2m[WebServer] [22m[0m[31m[pg-proxy] execProtocolRaw rejected: [0m[1m159 |[0m 				[0m[35mlet[0m settled = [0m[33mfalse[0m[0m[2m;[0m
[2m[WebServer] [22m[0m[1m160 |[0m 				[0m[35mconst[0m timer = setTimeout(() => {
[2m[WebServer] [22m[0m[1m161 |[0m 					[0m[35mif[0m (settled) [0m[35mreturn[0m[0m[2m;[0m
[2m[WebServer] [22m[0m[1m162 |[0m 					settled = [0m[33mtrue[0m[0m[2m;[0m
[2m[WebServer] [22m[0m[1m163 |[0m 					reject(
[2m[WebServer] [22m[0m[1m164 |[0m 						[0m[35mnew[0m [0m[1mError[0m(
[2m[WebServer] [22m                [31m[1m^[0m
[2m[WebServer] [22m[0m[31merror[0m[2m:[0m [1m[pg-proxy] unnamed-slot lock held >5000ms; acquire timeout[0m
[2m[WebServer] [22m[0m      [2mat [0m[0m[2m<anonymous>[0m[2m ([0m[0m[36m[2m/Users/antoniofulg/Projects/blog/[0m[36mtests/e2e/db.ts[0m[2m:[0m[33m164[0m[2m:[33m11[0m[2m)[0m
[2m[WebServer] [22m[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22m[0m[31m[2m2026-08-21T16:40:08.663Z[0m [31mERROR[0m [1m[Better Auth]:[0m Invalid password[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
error: script "test:e2e" exited with code 1

```
