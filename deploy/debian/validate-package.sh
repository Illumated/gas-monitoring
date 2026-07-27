#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source /etc/os-release
if [[ "${ID:-}" != "debian" || "${VERSION_ID:-}" != "13" ]]; then
  echo "Debian 13 is required; found ${ID:-unknown} ${VERSION_ID:-unknown}" >&2
  exit 1
fi

command -v docker >/dev/null
command -v systemd-analyze >/dev/null
test -r /etc/gas-monitoring/gas-monitoring.env

docker compose \
  --env-file /etc/gas-monitoring/gas-monitoring.env \
  -f "$repo/docker/compose.yaml" \
  -f "$repo/docker/compose.production.yaml" \
  config --quiet

systemd-analyze verify "$repo/deploy/debian/gas-monitoring.service"
echo "Debian 13 package validation passed"
