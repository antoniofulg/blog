#!/usr/bin/env bash
set -euo pipefail

: "${VPS_USER:?VPS_USER env var required}"
: "${VPS_HOST:?VPS_HOST env var required}"
: "${DEPLOY_PATH:?DEPLOY_PATH env var required}"
VPS_PORT="${VPS_PORT:-22}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:latest"

echo "[deploy] starting: $IMAGE → $VPS_USER@$VPS_HOST:$VPS_PORT"

ssh -p "$VPS_PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  "$VPS_USER@$VPS_HOST" \
  "docker pull $IMAGE && \
   cd '$DEPLOY_PATH' && \
   make db-migrate && \
   docker compose up -d --no-deps app && \
   echo '[deploy] done: $IMAGE'"
