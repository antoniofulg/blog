#!/usr/bin/env bash
set -euo pipefail

: "${VPS_USER:?VPS_USER env var required}"
: "${VPS_HOST:?VPS_HOST env var required}"
: "${DEPLOY_PATH:?DEPLOY_PATH env var required}"
VPS_PORT="${VPS_PORT:-22}"
TAG="${IMAGE_TAG:-latest}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:${TAG}"

echo "[deploy] starting: $IMAGE → $VPS_USER@$VPS_HOST:$VPS_PORT"

DOMAIN="${DEPLOY_DOMAIN:?DEPLOY_DOMAIN env var required}"

ssh -p "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  "$VPS_USER@$VPS_HOST" \
  "set -euo pipefail

   # Save current image for rollback
   OLD_IMAGE=\$(docker inspect --format='{{.Config.Image}}' \$(docker compose -f '$DEPLOY_PATH/docker-compose.prod.yml' ps -q app 2>/dev/null) 2>/dev/null || echo '')
   echo '[deploy] current: \${OLD_IMAGE:-none}'

   # Pull and migrate
   docker pull $IMAGE
   docker run --rm --env-file '$DEPLOY_PATH/.env' --network blog $IMAGE bun run db:migrate

   # Deploy new image
   GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=$TAG \
     docker compose -f '$DEPLOY_PATH/docker-compose.prod.yml' up -d --no-deps app

   # Smoke test
   echo '[deploy] running smoke test...'
   sleep 10
   if curl --fail --silent --max-time 10 https://$DOMAIN > /dev/null; then
     echo '[deploy] smoke test passed — done: $IMAGE'
   else
     echo '[deploy] smoke test FAILED — rolling back to \${OLD_IMAGE:-previous}'
     if [ -n \"\$OLD_IMAGE\" ]; then
       docker tag \"\$OLD_IMAGE\" ghcr.io/$GHCR_OWNER/$GHCR_REPO:latest
       GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=latest \
         docker compose -f '$DEPLOY_PATH/docker-compose.prod.yml' up -d --no-deps app
       echo '[deploy] rollback complete'
     else
       echo '[deploy] no previous image to roll back to'
     fi
     exit 1
   fi"
