#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_DIR
readonly OUTPUT_DIR="${1:?usage: build-bundle.sh OUTPUT_DIR FACTORY_CONFIG}"
readonly FACTORY_CONFIG="${2:?usage: build-bundle.sh OUTPUT_DIR FACTORY_CONFIG}"

# shellcheck disable=SC1091
source "$REPO_DIR/factory/versions.env"
export DOCKER_CE_VERSION CONTAINERD_VERSION DOCKER_BUILDX_VERSION
export DOCKER_COMPOSE_VERSION SALT_VERSION

[[ "$(uname -m)" == "x86_64" ]] || {
  echo "x86_64 Linux build host is required" >&2
  exit 1
}
[[ -r "$FACTORY_CONFIG" ]] || {
  echo "Factory config not found: $FACTORY_CONFIG" >&2
  exit 1
}
[[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]] || {
  echo "Refusing to build from a dirty Git worktree" >&2
  exit 1
}

command -v docker >/dev/null
command -v git >/dev/null
command -v sha256sum >/dev/null

npm --prefix "$REPO_DIR" test
docker compose \
  -f "$REPO_DIR/docker/compose.yaml" \
  -f "$REPO_DIR/docker/compose.production.yaml" \
  build node-red
docker pull "influxdb:2.7.12@sha256:b8d940ca9376f85118260f5b6bd236b8a00b1749c3350c5578d4cde8e27f31f2"
docker tag \
  "influxdb@sha256:b8d940ca9376f85118260f5b6bd236b8a00b1749c3350c5578d4cde8e27f31f2" \
  influxdb:2.7.12

rm -rf "$OUTPUT_DIR"
install -d -m 0755 "$OUTPUT_DIR/app" "$OUTPUT_DIR/images" "$OUTPUT_DIR/packages"
git -C "$REPO_DIR" archive HEAD | tar -x -C "$OUTPUT_DIR/app"
install -m 0600 "$FACTORY_CONFIG" "$OUTPUT_DIR/factory.env"
install -m 0700 "$REPO_DIR/factory/provision.sh" "$OUTPUT_DIR/provision.sh"
install -m 0644 "$REPO_DIR/factory/factory-provision.service" \
  "$OUTPUT_DIR/factory-provision.service"

docker save gas-monitoring-node-red:0.1.0 \
  --output "$OUTPUT_DIR/images/gas-monitoring-node-red-0.1.0.tar"
docker save influxdb:2.7.12 \
  --output "$OUTPUT_DIR/images/influxdb-2.7.12.tar"

docker run --rm \
  --mount "type=bind,src=$OUTPUT_DIR/packages,dst=/packages" \
  -e DOCKER_CE_VERSION \
  -e CONTAINERD_VERSION \
  -e DOCKER_BUILDX_VERSION \
  -e DOCKER_COMPOSE_VERSION \
  -e SALT_VERSION \
  "$FACTORY_BUILDER_IMAGE" bash -euxc '
    apt-get update
    apt-get install -y ca-certificates curl
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
      -o /etc/apt/keyrings/docker.asc
    curl -fsSL \
      https://packages.broadcom.com/artifactory/api/security/keypair/SaltProjectKey/public \
      -o /etc/apt/keyrings/salt-archive-keyring.pgp
    printf "%s\n" \
      "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" \
      >/etc/apt/sources.list.d/docker.list
    printf "%s\n" \
      "deb [signed-by=/etc/apt/keyrings/salt-archive-keyring.pgp] https://packages.broadcom.com/artifactory/saltproject-deb stable main" \
      >/etc/apt/sources.list.d/salt.list
    apt-get update
    apt-get install -y --download-only \
      -o Dir::Cache::archives=/packages \
      "docker-ce=$DOCKER_CE_VERSION" \
      "docker-ce-cli=$DOCKER_CE_VERSION" \
      "containerd.io=$CONTAINERD_VERSION" \
      "docker-buildx-plugin=$DOCKER_BUILDX_VERSION" \
      "docker-compose-plugin=$DOCKER_COMPOSE_VERSION" \
      "salt-common=$SALT_VERSION" \
      "salt-minion=$SALT_VERSION"
    rm -f /packages/lock
    rm -rf /packages/partial
  '

manifest_tmp="$(mktemp)"
(
  cd "$OUTPUT_DIR"
  find . -type f ! -name SHA256SUMS -print0 |
    sort -z |
    xargs -0 sha256sum >"$manifest_tmp"
)
mv "$manifest_tmp" "$OUTPUT_DIR/SHA256SUMS"
echo "Factory bundle created: $OUTPUT_DIR"
