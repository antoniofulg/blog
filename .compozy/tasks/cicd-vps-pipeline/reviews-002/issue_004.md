---
provider: manual
pr:
round: 2
round_created_at: 2026-05-06T17:31:48Z
status: resolved
file: scripts/deploy.sh
line: 12
severity: low
author: claude-code
provider_ref:
---

# Issue 004: SSH has no ConnectTimeout; hangs indefinitely if VPS unreachable

## Review Comment

The `ssh` invocation sets `StrictHostKeyChecking=accept-new` but no `ConnectTimeout`:

```bash
ssh -p "$VPS_PORT" -o StrictHostKeyChecking=accept-new \
  "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && ..."
```

If the VPS is unreachable (network outage, wrong IP, firewall drop), SSH uses the OS TCP connection timeout — typically 2 minutes on Linux. The deploy job in `cd.yml` has no `timeout-minutes:` set either, so the job runs for up to GitHub's 6-hour workflow maximum before failing. The developer would see a stuck "deploy" step with no output and no clear signal that the VPS is unreachable.

**Fix**: Add `ConnectTimeout` and `ServerAliveInterval` + `ServerAliveCountMax` to bound the hang window:

```bash
ssh -p "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && ..."
```

With these settings, the script fails within 30 seconds if the VPS is unreachable at connect time, and within ~45 seconds if the SSH session goes silent mid-deploy.

## Triage

- Decision: `valid`
- Notes: `ssh` had no `ConnectTimeout`; unreachable VPS would hang up to 2 min (OS TCP timeout) with no job timeout set, blocking the deploy job for hours. Added `ConnectTimeout=30`, `ServerAliveInterval=15`, `ServerAliveCountMax=3` — fails within 30s if unreachable, within ~45s if session goes silent mid-deploy.
