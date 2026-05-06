---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: scripts/deploy.sh
line: 15
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: $DEPLOY_PATH unquoted in SSH remote command breaks on spaces

## Review Comment

The SSH remote command expands `$DEPLOY_PATH` inside double quotes, so the remote shell receives it unquoted:

```bash
ssh ... "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && \
   cd $DEPLOY_PATH && \       # ← no quotes around the expanded value
   make db-migrate && ..."
```

If `DEPLOY_PATH` is `/home/deploy/my blog`, the remote shell sees `cd /home/deploy/my blog` and `cd` only navigates to `/home/deploy/my`. `make db-migrate` then runs from the wrong directory, failing silently or migrating the wrong project.

**Fix**: Wrap the variable in single quotes within the double-quoted SSH string. Since `$DEPLOY_PATH` is expanded locally (outer double quotes), the remote receives a properly quoted literal:

```bash
ssh ... "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && \
   cd '$DEPLOY_PATH' && \
   make db-migrate && ..."
```

This handles spaces in the path. (Paths with embedded single quotes are not a realistic concern for a deploy path.)

## Triage

- Decision: `valid`
- Notes: Confirmed in `scripts/deploy.sh` line 15: `cd $DEPLOY_PATH` is unquoted within the outer double-quoted SSH string. Fix: wrap in single quotes → `cd '$DEPLOY_PATH'`. Single-quote handles spaces; paths with embedded single quotes are not a realistic concern for a deploy path.
