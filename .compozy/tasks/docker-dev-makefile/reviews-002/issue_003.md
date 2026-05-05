---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T16:57:09Z
status: resolved
file: Makefile
line: 24
severity: low
author: claude-code
provider_ref:
---

# Issue 003: make setup pg_isready loop has no timeout — hangs forever if DB fails

## Review Comment

The `setup` target waits for Postgres to become healthy using a bare `until` loop:

```makefile
@until docker compose exec db pg_isready -U blog > /dev/null 2>&1; do sleep 1; done
```

There is no timeout. If Postgres fails to start (port 5432 already in use, Docker volume corruption, insufficient memory), the loop runs indefinitely. The contributor sees a frozen terminal with no indication of what is wrong or how long to wait.

The PRD success criterion is "fresh clone to running app in under 3 minutes." An unbounded wait violates that constraint in failure scenarios and gives no diagnostic guidance.

**Fix**: Add a counter and bail after a reasonable timeout (30 seconds covers all normal startup cases):

```makefile
@echo "Waiting for database..."; \
  i=0; \
  until docker compose exec db pg_isready -U blog > /dev/null 2>&1; do \
    i=$$((i+1)); \
    if [ $$i -ge 30 ]; then \
      echo "ERROR: Postgres did not become ready after 30 seconds."; \
      echo "Check: docker compose logs db"; \
      exit 1; \
    fi; \
    sleep 1; \
  done
```

The `docker compose logs db` hint is important — it tells contributors exactly where to look when setup stalls.

## Triage

- Decision: `valid`
- Notes: Confirmed — the bare `until` loop had no counter, no timeout, and no diagnostic output. If Postgres fails to start (port conflict, volume corruption, OOM), the loop hangs the terminal indefinitely with no guidance.

  **Fix applied:** Replaced the two-line echo + until loop in `Makefile` `setup` target with a single compound shell command that adds a counter (`i`), bails after 30 iterations (30 seconds), and prints a diagnostic hint (`docker compose logs db`) on timeout. Uses `$$((i+1))` (Make double-dollar escape) for portable POSIX arithmetic.
