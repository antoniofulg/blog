#!/usr/bin/env bash
set -euo pipefail

: "${VPS_USER:?VPS_USER env var required}"
: "${VPS_HOST:?VPS_HOST env var required}"
: "${DEPLOY_PATH:?DEPLOY_PATH env var required}"
VPS_PORT="${VPS_PORT:-22}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TAG="${IMAGE_TAG:-latest}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:${TAG}"

echo "[deploy] starting: $IMAGE → $VPS_USER@$VPS_HOST:$VPS_PORT"

DOMAIN="${DEPLOY_DOMAIN:-}"

# Sync compose file from repo to VPS (compose is CD-managed, not VPS-managed)
echo "[deploy] syncing docker-compose.prod.yml → $DEPLOY_PATH/$COMPOSE_FILE"
scp -P "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  docker-compose.prod.yml \
  "$VPS_USER@$VPS_HOST:$DEPLOY_PATH/$COMPOSE_FILE"

ssh -p "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  "$VPS_USER@$VPS_HOST" \
  "set -euo pipefail

   # Pre-flight: verify required vars exist in .env (grep avoids $ interpolation)
   for _var in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL BETTER_AUTH_SECRET; do
     grep -q "^\$_var=" '$DEPLOY_PATH/.env' 2>/dev/null || { echo "[deploy] ERROR: \$_var not set in '$DEPLOY_PATH/.env'"; exit 1; }
   done

   # Save current image for rollback
   OLD_IMAGE=\$(docker inspect --format='{{.Config.Image}}' \$(docker compose -f '$DEPLOY_PATH/$COMPOSE_FILE' ps -q app 2>/dev/null) 2>/dev/null || echo '')
   echo '[deploy] current: \${OLD_IMAGE:-none}'

   # Pull new image
   docker pull $IMAGE

   # Ensure DB is running and healthy before migrations (also creates blog network)
   GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=$TAG \
     docker compose -f '$DEPLOY_PATH/$COMPOSE_FILE' up -d --wait db

   # Run migrations inside pulled image
   docker run --rm --env-file '$DEPLOY_PATH/.env' --network blog $IMAGE bun run db:migrate

   # Sync posts from content/ into the posts table
   docker run --rm --env-file '$DEPLOY_PATH/.env' --network blog $IMAGE bun run sync

   # Deploy new image
   GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=$TAG \
     docker compose -f '$DEPLOY_PATH/$COMPOSE_FILE' up -d --no-deps app

   # Smoke test (skipped when DEPLOY_DOMAIN is unset). On failure: rollback + exit.
   if [ -n \"$DOMAIN\" ]; then
     echo '[deploy] running smoke test...'
     sleep 10
     if ! curl --fail --silent --max-time 10 https://$DOMAIN > /dev/null; then
       echo '[deploy] smoke test FAILED — rolling back to \${OLD_IMAGE:-previous}'
       if [ -n \"\$OLD_IMAGE\" ]; then
         docker tag \"\$OLD_IMAGE\" ghcr.io/$GHCR_OWNER/$GHCR_REPO:latest
         GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO IMAGE_TAG=latest \
           docker compose -f '$DEPLOY_PATH/$COMPOSE_FILE' up -d --no-deps app
         echo '[deploy] rollback complete'
       else
         echo '[deploy] no previous image to roll back to'
       fi
       exit 1
     fi
     echo '[deploy] smoke test passed'
   fi

   # Prune stale images: keep current ($IMAGE) + 1 rollback candidate (\$OLD_IMAGE).
   # Drop every other ghcr.io/$GHCR_OWNER/$GHCR_REPO tag/digest and dangling blobs.
   NEW_ID=\$(docker image inspect --format='{{.Id}}' '$IMAGE' 2>/dev/null || true)
   OLD_ID=\$(docker image inspect --format='{{.Id}}' \"\$OLD_IMAGE\" 2>/dev/null || true)
   if [ -n \"\$NEW_ID\" ]; then
     docker images --no-trunc --format '{{.ID}}' 'ghcr.io/$GHCR_OWNER/$GHCR_REPO' \
       | sort -u \
       | grep -vxF -e \"\$NEW_ID\" -e \"\${OLD_ID:-__none__}\" \
       | xargs -r docker rmi -f >/dev/null 2>&1 || true
     docker image prune -f >/dev/null 2>&1 || true
   fi

   echo '[deploy] done: $IMAGE'"
