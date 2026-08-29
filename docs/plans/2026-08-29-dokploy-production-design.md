# Dokploy production deployment design

## Goal

Move production delivery from Coolify to Dokploy without building the blog on
the 4 GB VPS, and add a reliable health signal for zero-downtime updates and
automatic rollback.

S3 backups and notifications are explicitly deferred.

## Delivery flow

1. CI remains the quality gate for pushes to `main`.
2. CD builds the `runner` image on GitHub Actions and publishes immutable SHA
   and convenience `latest` tags to the public GHCR package.
3. CD asks Dokploy to deploy the application through a dedicated API key with
   the least permissions available, stored as `DOKPLOY_API_KEY` in GitHub
   Actions secrets.
4. Dokploy pulls the published image; production secrets remain runtime
   environment variables in Dokploy.

The workflow must never contain a credential or call the retired Coolify API.

## Health and rollout

- Add a public `GET /healthz` server route.
- The handler executes a minimal PostgreSQL query and returns `200` only when
  both the HTTP process and database are ready.
- Install `curl` in the runner image for the Docker Swarm health check.
- Configure Dokploy with a generous start period because the container runs
  migrations and content synchronization before starting HTTP.
- Use a `start-first` update with one task at a time and automatic rollback on
  health-check failure.

## Cleanup

Enable Dokploy's built-in Docker cleanup. Do not schedule a custom prune and do
not remove volumes.

## Verification

- Unit-test the health handler for healthy and unavailable database outcomes.
- Run formatting, type checking, relevant Bun tests, route generation, and a
  production Docker build.
- Confirm the GitHub workflow no longer references Coolify.
- Confirm `/healthz`, the public blog, PostgreSQL-backed analytics counts, and
  the Dokploy deployment status after rollout.
