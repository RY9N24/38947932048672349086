#!/usr/bin/env bash
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y docker.io docker-compose-v2
fi
systemctl enable --now docker
docker version --format '{{.Server.Version}}'
docker compose version
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi
