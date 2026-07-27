#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_CE_VERSION:?set an exact docker-ce version from apt-cache madison docker-ce}"
: "${CONTAINERD_VERSION:?set an exact containerd.io version from apt-cache madison containerd.io}"
: "${DOCKER_BUILDX_VERSION:?set an exact docker-buildx-plugin version from apt-cache madison docker-buildx-plugin}"
: "${DOCKER_COMPOSE_VERSION:?set an exact docker-compose-plugin version from apt-cache madison docker-compose-plugin}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on Debian 13." >&2
  exit 1
fi

. /etc/os-release
if [[ "${ID:-}" != "debian" || "${VERSION_ID:-}" != "13" ]]; then
  echo "This installer supports Debian 13 only." >&2
  exit 2
fi

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y \
  "docker-ce=${DOCKER_CE_VERSION}" \
  "docker-ce-cli=${DOCKER_CE_VERSION}" \
  "containerd.io=${CONTAINERD_VERSION}" \
  "docker-buildx-plugin=${DOCKER_BUILDX_VERSION}" \
  "docker-compose-plugin=${DOCKER_COMPOSE_VERSION}"

systemctl enable --now docker
docker version
docker compose version
