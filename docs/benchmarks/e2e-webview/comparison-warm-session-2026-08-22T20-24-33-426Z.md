# Bun Playwright vs Bun.WebView — warm-session

- Commit: `d4f09c6ede2d7d3681d6d07a109a6a8ffcae408d`
- Timestamp: 2026-08-22T20:24:33.426Z
- Host: Antonios-MacBook-Pro.local (Apple M3 Pro, 11 cores)
- Scenarios per pass: 5
- Measured samples per arm: 10
- Warm-ups per arm: 2
- Browser: same Chromium executable in both arms
- Server: one shared Bun server, excluded from measured process groups

## Primary result

| Arm | Median | Min | Max | Total | Median browser RSS | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bun + Playwright | 0.514 s | 0.455 s | 0.540 s | 5.057 s | 800.7 MiB | 10 |
| Bun.WebView | 1.476 s | 1.449 s | 1.677 s | 14.998 s | 915.1 MiB | 10 |

WebView delta: 187.38% (slower).

## Warm-session result including in-session warm-ups

| Arm | Median | Min | Max | Total | Median browser RSS | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bun + Playwright | 0.525 s | 0.455 s | 0.643 s | 6.259 s | 800.7 MiB | 12 |
| Bun.WebView | 1.480 s | 1.449 s | 2.571 s | 20.125 s | 915.1 MiB | 12 |

WebView delta: 181.69% (within-noise).

## Whole-session process cost

| Arm | Median total process time | Min | Max | Sessions |
| --- | ---: | ---: | ---: | ---: |
| Bun + Playwright | 3.984 s | 3.921 s | 4.046 s | 2 |
| Bun.WebView | 10.313 s | 10.176 s | 10.449 s | 2 |

Primary warm-session timings measure only each five-scenario pass with the browser already open. Each whole session includes browser startup, one internal warm-up, 5 measured passes, and shutdown.

