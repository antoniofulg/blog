---
provider: manual
pr:
round: 3
round_created_at: 2026-05-05T17:17:52Z
status: resolved
file: Makefile
line: 39
severity: low
author: claude-code
provider_ref:
---

# Issue 003: make preview fails on second run if first run was interrupted

## Review Comment

The `preview` target names the container explicitly:

```makefile
docker run --rm \
  --env-file .env \
  --network blog \
  -e DATABASE_URL=postgres://blog:blog@db:5432/blog \
  -p 3000:3000 \
  --name $(CONTAINER_APP) \
  $(IMAGE_NAME)
```

`--rm` removes the container after it exits cleanly. However, if `make preview` is interrupted with Ctrl+C (SIGINT), Docker receives the signal, stops the container, but — depending on timing — may not always remove the stopped container before the shell returns. A stopped (not running) container with the name `blog-app` is left behind. On the next `make preview` run:

```
docker: Error response from daemon: Conflict. The container name "/blog-app" is already in use
```

The user must manually `docker rm blog-app` before `make preview` works again. This breaks the workflow silently — the error message gives no hint that a prior interrupted run caused the conflict.

**Fix**: Add an explicit pre-run cleanup step that removes a stopped container of the same name if one exists, without failing if no such container is present:

```makefile
preview: ## Run production image locally (validates build before deploy; requires: make dev or docker compose up db -d)
	@docker rm -f $(CONTAINER_APP) 2>/dev/null || true
	docker run --rm \
	  --env-file .env \
	  --network blog \
	  -e DATABASE_URL=postgres://blog:blog@db:5432/blog \
	  -p 3000:3000 \
	  --name $(CONTAINER_APP) \
	  $(IMAGE_NAME)
```

`docker rm -f` stops and removes the container if it exists; exits 0 even if there is nothing to remove. The `@` suppresses echo; `|| true` guards against the Make exit-on-error default for this one-liner. The prefixed `@` keeps the cleanup silent on normal runs.

## Triage

- Decision: `valid`
- Notes: `preview` uses `--name $(CONTAINER_APP)` and `--rm`. When interrupted with Ctrl+C, Docker may not remove the stopped container before the shell returns, leaving a name conflict for subsequent runs. Fix: add `@docker rm -f $(CONTAINER_APP) 2>/dev/null || true` as the first recipe line so any stopped leftover is silently cleaned up. The fake-docker test for `preview` uses `toContain` assertions, so the extra `rm -f` log line does not break it.
