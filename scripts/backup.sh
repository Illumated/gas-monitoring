#!/usr/bin/env bash
set -euo pipefail

project="${COMPOSE_PROJECT_NAME:-gas-monitoring}"
repository="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-$repository/backups/$(date -u +%Y%m%dT%H%M%SZ)}"
image="gas-monitoring-node-red:0.1.0"

mkdir -p "$target"

for name in node-red-data influxdb-data influxdb-config auth-data; do
  volume="${project}_${name}"
  docker volume inspect "$volume" >/dev/null
  exclude=""
  if [[ "$name" == "node-red-data" ]]; then
    exclude="--exclude=./.npm"
  fi
  docker run --rm \
    --volume "$volume:/source:ro" \
    --volume "$target:/backup" \
    --entrypoint sh \
    "$image" \
    -c "cd /source && tar $exclude -czf /backup/$name.tar.gz ."
done

(
  cd "$target"
  sha256sum ./*.tar.gz >SHA256SUMS
)

{
  printf 'created_utc=%s\n' "$(date -u +%FT%TZ)"
  printf 'git_commit=%s\n' "$(git -C "$repository" rev-parse HEAD)"
  printf 'project_name=%s\n' "$project"
  printf 'secrets_included=false\n'
} >"$target/manifest.env"

echo "Backup created: $target"
