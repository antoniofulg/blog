# Bun 1.3.14 vs 1.4.0 — benchmark report

Run started 2026-08-21T05:22:40.380Z on Antonios-MacBook-Pro.local (Apple M3 Pro, 11 cores, 18432.0 MB RAM, power: ac, 1-min load at start: 5.40).

Medians over the timed repetitions, warm-up discarded. A delta smaller than the run's own min-to-max spread is reported as `within noise` and must not be quoted as an improvement.

## Workloads

| Workload | 1.3.14 median | 1.4.0 median | Delta | Delta % | Verdict |
| -------- | -------------- | ------------- | ----- | ------- | ------- |
| `install-cold` | 9.21 s | 9.00 s | 214 ms | -2.3% | within noise |
| `install-warm` | 2.06 s | 1.28 s | 781 ms | -38.0% | faster |
| `build` | 4.68 s | 4.68 s | 6 ms | +0.1% | within noise |
| `test` | n/a | n/a | n/a | n/a | no result |
| `test-e2e` | 11.55 s | n/a | n/a | n/a | no result |
| `lint` | n/a | n/a | n/a | n/a | no result |
| `check` | 3.77 s | 3.86 s | 95 ms | +2.5% | slower |
| `sync` | 6.37 s | 6.76 s | 393 ms | +6.2% | slower |
| `audit-fe` | 22.10 s | 21.61 s | 498 ms | -2.3% | faster |

## Runtime (production bundle)

| Version | Boot | Idle RSS | Peak RSS | Post-load RSS | p50 | p95 | p99 | Requests |
| ------- | ---- | -------- | -------- | ------------- | --- | --- | --- | -------- |
| 1.3.14 | 223 ms | 208.6 MB | 556.5 MB | 557.3 MB | 2.21 s | 2.98 s | 3.92 s | 300 |
| 1.4.0 | 203 ms | 136.3 MB | 584.2 MB | 584.2 MB | 632 ms | 779 ms | 2.44 s | 994 |

Resident memory is sampled every 100 ms, so peaks shorter than that are missed. The bias is identical for both versions.

## Findings

| Workload | Version | Kind | Exit code |
| -------- | ------- | ---- | --------- |
| `test` | 1.3.14 | compat | 1 |
| `test-e2e` | 1.3.14 | compat | 1 |
| `lint` | 1.3.14 | compat | 1 |
| `test` | 1.4.0 | compat | 1 |
| `test-e2e` | 1.4.0 | compat | 1 |
| `lint` | 1.4.0 | compat | 1 |

### `test` under 1.3.14 (compat)

```

  × Some errors were emitted while running checks.
  


[36m [2m❯[22m app/tests/biome.test.ts:[2m15:18[22m[39m
    [90m 13|[39m [34mdescribe[39m([32m"biome configuration"[39m[33m,[39m () [33m=>[39m {
    [90m 14|[39m  [34mit[39m([32m"biome check . exits 0 on clean project"[39m[33m,[39m () [33m=>[39m {
    [90m 15|[39m   [35mconst[39m result [33m=[39m [34mexecSync[39m([32m"bunx biome check ."[39m[33m,[39m {
    [90m   |[39m                  [31m^[39m
    [90m 16|[39m    cwd[33m:[39m root[33m,[39m
    [90m 17|[39m    encoding[33m:[39m [32m"utf8"[39m[33m,[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m

close timed out after 10000ms
Tests closed successfully but something prevents Vite server from exiting
You can try to identify the cause by enabling "hanging-process" reporter. See https://vitest.dev/guide/reporters.html#hanging-process-reporter
error: script "test" exited with code 1

```

### `test-e2e` under 1.3.14 (compat)

```
$ playwright test
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22m[0m[31m[2m2026-08-21T05:26:26.020Z[0m [31mERROR[0m [1m[Better Auth]:[0m Invalid password[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
error: script "test:e2e" exited with code 1

```

### `lint` under 1.3.14 (compat)

```
   > 4 │ <html style='scrollbar-gutter: stable both-edges;'>
       │ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   > 5 │   <head>
        ...
  > 14 │     <div id='root'></div>
  > 15 │   </body>
  > 16 │ </html>
       │ ^^^^^^^
    17 │ 
  
  i Setting a lang attribute on HTML document elements configures the language used by screen readers when no user default is specified.
  

lint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.
  

error: script "lint" exited with code 1

```

### `test` under 1.4.0 (compat)

```

  × Some errors were emitted while running checks.
  


[36m [2m❯[22m app/tests/biome.test.ts:[2m15:18[22m[39m
    [90m 13|[39m [34mdescribe[39m([32m"biome configuration"[39m[33m,[39m () [33m=>[39m {
    [90m 14|[39m  [34mit[39m([32m"biome check . exits 0 on clean project"[39m[33m,[39m () [33m=>[39m {
    [90m 15|[39m   [35mconst[39m result [33m=[39m [34mexecSync[39m([32m"bunx biome check ."[39m[33m,[39m {
    [90m   |[39m                  [31m^[39m
    [90m 16|[39m    cwd[33m:[39m root[33m,[39m
    [90m 17|[39m    encoding[33m:[39m [32m"utf8"[39m[33m,[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m

close timed out after 10000ms
Tests closed successfully but something prevents Vite server from exiting
You can try to identify the cause by enabling "hanging-process" reporter. See https://vitest.dev/guide/reporters.html#hanging-process-reporter
error: script "test" exited with code 1

```

### `test-e2e` under 1.4.0 (compat)

```
$ playwright test
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22m[0m[31m[2m2026-08-21T05:33:07.535Z[0m [31mERROR[0m [1m[Better Auth]:[0m Invalid password[0m
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
[1A[2K[2m[WebServer] [22mNo IP address found for rate limiting
error: script "test:e2e" exited with code 1

```

### `lint` under 1.4.0 (compat)

```
   > 4 │ <html style='scrollbar-gutter: stable both-edges;'>
       │ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   > 5 │   <head>
        ...
  > 14 │     <div id='root'></div>
  > 15 │   </body>
  > 16 │ </html>
       │ ^^^^^^^
    17 │ 
  
  i Setting a lang attribute on HTML document elements configures the language used by screen readers when no user default is specified.
  

lint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.
  

error: script "lint" exited with code 1

```
