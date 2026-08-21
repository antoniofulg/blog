# Bun benchmark — all runs

2 run(s). Each cell is the time delta of the later version against the earlier one, with the median load average both sides ran under in parentheses. A workload whose sign changes between runs has not been measured reliably, whatever a single report says.

| Workload | 08-21T19:23 | 08-21T20:31 |
| -------- | --- | --- |
| `install-cold` | -30.2% (7/9) | -0.8% ~ (6/8) |
| `install-warm` | -24.7% (11/12) | -33.1% (9/9) |
| `build` | -14.2% ~ (10/8) | -3.8% ~ (11/10) |
| `test` | -1.3% ~ (31/21) | +1.8% ~ (10/12) |
| `test-e2e` | -3.2% ~ (17/8) | -21.6% (17/9) |
| `lint` | +4.6% ~ (9/7) | -8.0% ~ (11/11) |
| `check` | +18.5% ~ (8/7) | +2.5% ~ (16/15) |
| `sync` | +2.8% ~ (7/7) | +76.4% ~ (16/21) |
| `audit-fe` | -0.1% ~ (7/10) | -5.2% ~ (12/10) |

`~` marks a delta inside that run's own noise band.
