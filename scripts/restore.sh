#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 BACKUP_DIRECTORY TARGET_PROJECT_NAME" >&2
  exit 2
fi

backup="$(realpath "$1")"
project="$2"
image="gas-monitoring-node-red:0.1.0"

if [[ ! "$project" =~ ^[a-z0-9][a-z0-9_-]+$ ]]; then
  echo "Invalid target project name" >&2
  exit 3
fi

(
  cd "$backup"
  sha256sum --check SHA256SUMS
)

for name in node-red-data influxdb-data influxdb-config auth-data; do
  volume="${project}_${name}"
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    echo "Target volume already exists: $volume" >&2
    exit 4
  fi
done

for name in node-red-data influxdb-data influxdb-config auth-data; do
  volume="${project}_${name}"
  docker volume create "$volume" >/dev/null
  docker run --rm \
    --user 0:0 \
    --volume "$volume:/target" \
    --volume "$backup:/backup:ro" \
    --entrypoint sh \
    "$image" \
    -c "tar xzf /backup/$name.tar.gz -C /target"
done

echo "Restore completed into volumes with prefix: $project"
