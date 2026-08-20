# VPS Setup — Coolify

Production runs on the self-hosted Coolify instance. The old direct Docker
Compose procedure remains in `VPS_SETUP_LEGACY.md` only for disaster recovery.

## Access

The Coolify panel is bound to the VPS loopback interface. Open it through an
SSH tunnel:

```sh
ssh -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -L 127.0.0.1:18000:127.0.0.1:8000 \
  creatista-vps
```

Then visit `http://127.0.0.1:18000`.

## Production resources

- Project: `Blog`
- Environment: `production`
- Application: `blog-app`
- Database: `blog-db` (`postgres:16-alpine`, private Docker network)
- Image: `ghcr.io/antoniofulg/blog:<full-commit-sha>`
- Application health check: `/` on port `3000`

Runtime secrets belong in Coolify environment variables. Never add them to the
Docker image, workflow, repository, or this document.

Configure on **blog-app** (not `blog-db`):

| Variable | Notes |
|---|---|
| `SITE_URL` | `https://antoniofulg.tech` — no trailing slash |
| `BETTER_AUTH_URL` | Optional override for the public auth origin; defaults to `SITE_URL`. |
| `BETTER_AUTH_SECRET` | Session signing key |
| `DATABASE_URL` | App Postgres |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only; changing them does not update an existing user |

## Automatic deployment

After a merge to `main`:

1. CI must pass for the merge commit.
2. CD builds the checked-out commit and pushes `:latest` plus the immutable full
   SHA to GHCR.
3. CD sends an authenticated `PATCH` to the restricted Caddy endpoint.
4. Coolify selects that SHA and queues deployment.
5. The new container runs migrations and content sync before starting HTTP.
6. Coolify promotes it only after the health check passes.

GitHub needs one deploy secret:

| Secret | Scope |
|---|---|
| `COOLIFY_WRITE_TOKEN` | Coolify API token with only `Write` permission |

Caddy exposes only `PATCH /_ops/coolify/blog/deploy` for this application. The
Coolify panel and the remaining API stay on loopback.

## Rollback

Select a previous full commit SHA as the application image tag in Coolify and
deploy it. Database migrations must remain backward-compatible with the prior
application version.

The old SSH/Compose path requires explicit `ALLOW_LEGACY_SSH_DEPLOY=1`; see
`VPS_SETUP_LEGACY.md`.
