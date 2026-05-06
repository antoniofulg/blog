#!/usr/bin/env bash
set -euo pipefail

: "${VPS_USER:?VPS_USER env var required}"
: "${VPS_HOST:?VPS_HOST env var required}"
: "${DEPLOY_PATH:?DEPLOY_PATH env var required}"
VPS_PORT="${VPS_PORT:-22}"
TAG="${IMAGE_TAG:-latest}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:${TAG}"

echo "[deploy] starting: $IMAGE → $VPS_USER@$VPS_HOST:$VPS_PORT"

ssh -p "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && \
   docker run --rm --env-file '$DEPLOY_PATH/.env' --network blog $IMAGE bun run db:migrate && \
   GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=$TAG \
     docker compose -f '$DEPLOY_PATH/docker-compose.prod.yml' up -d --no-deps app && \
   echo '[deploy] done: $IMAGE'"
