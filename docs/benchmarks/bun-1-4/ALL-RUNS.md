# Bun benchmark — all runs

5 run(s). Each cell is the time delta of the later version against the earlier one, with the median load average both sides ran under in parentheses. A workload whose sign changes between runs has not been measured reliably, whatever a single report says.

| Workload | 08-21T05:22 | 08-21T05:47 | 08-21T06:17 | 08-21T13:39 | 08-21T16:25 |
| -------- | --- | --- | --- | --- | --- |
| `install-cold` | -2.3% ~ (?/?) | +10.5% ~ (?/?) | n/a | n/a | n/a |
| `install-warm` | -38.0% (?/?) | -30.7% (?/?) | n/a | n/a | n/a |
| `build` | +0.1% ~ (?/?) | -0.3% ~ (?/?) | n/a | n/a | n/a |
| `test` | n/a | -0.4% ~ (?/?) | n/a | n/a | +0.6% ~ (?/?) |
| `test-e2e` | n/a | n/a | n/a | -10.7% ~ (?/?) | +5.7% ~ (?/?) |
| `lint` | n/a | -1.3% ~ (?/?) | n/a | n/a | n/a |
| `check` | +2.5% (?/?) | +0.8% (?/?) | n/a | n/a | n/a |
| `sync` | +6.2% (?/?) | +4.0% (?/?) | n/a | n/a | n/a |
| `audit-fe` | -2.3% (?/?) | -1.2% (?/?) | n/a | n/a | n/a |

`~` marks a delta inside that run's own noise band.
