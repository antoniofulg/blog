---
provider: manual
pr:
round: 1
round_created_at: 2026-05-05T15:55:14Z
status: resolved
file: Makefile
line: 17
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: make setup exits 1 on every clean clone — validation matches working dev URL

## Review Comment

The `setup` target validates that `DATABASE_URL` has been changed from the default, but the grep pattern matches the default LOCAL dev URL that all contributors should use:

```makefile
@grep -q 'DATABASE_URL=postgres://blog:blog@localhost' .env \
  && echo "ERROR: Change DATABASE_URL in .env before running setup." && exit 1 \
  || true
```

`.env.example` contains `DATABASE_URL=postgres://blog:blog@localhost:5432/blog`. After `cp .env.example .env` (or on a clone where `.env` is tracked), the grep pattern `postgres://blog:blog@localhost` is a prefix of that URL and matches. The `&&` chain fires, prints the error, and calls `exit 1`.

Result: every contributor who runs `make setup` on a fresh clone immediately gets:
```
ERROR: Change DATABASE_URL in .env before running setup.
```
and setup stops. F2 (zero-config onboarding) is completely broken.

The validation was designed for a scenario where `.env.example` contains a non-functional placeholder (e.g., `YOUR_DB_URL_HERE`) that the user must replace with a real value. It is incompatible with a scaffold where the default URL is the correct working value for local Docker dev.

**Fix** (choose one):

1. **Remove the validation guard entirely.** The default URL works with the included Docker Compose setup; no contributor action is required:
   ```makefile
   setup: ## First-clone: copy .env, start DB, run migrations
   	@test -f .env || cp .env.example .env
   	docker compose pull db
   	docker compose up db -d
   	...
   ```

2. **Change `.env.example` to use a placeholder** and update `DATABASE_URL` default to match a non-local pattern (e.g., `postgres://CHANGE_ME:CHANGE_ME@localhost:5432/blog`), then the validation guard correctly catches unchanged credentials.

Option 1 is simpler and consistent with the zero-config PRD goal.

## Triage

- Decision: `VALID`
- Root cause: grep pattern `DATABASE_URL=postgres://blog:blog@localhost` is a prefix of the `.env.example` value `postgres://blog:blog@localhost:5432/blog`. After `cp .env.example .env`, the pattern always matches, so the `&&` chain always fires and exits 1. Zero-config onboarding (F2) is broken on every fresh clone.
- Fix: Remove the grep validation block (lines 20-22). The default URL works with the included Docker setup; no contributor action is required.
