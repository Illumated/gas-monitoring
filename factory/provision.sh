#!/usr/bin/env bash
set -euo pipefail

readonly PAYLOAD_DIR="/opt/rinir-factory"
readonly LOG_FILE="/var/log/rinir-factory-provision.log"

exec > >(tee -a "$LOG_FILE") 2>&1

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ "$(id -u)" -eq 0 ]] || die "run as root"
cd "$PAYLOAD_DIR"
sha256sum --check SHA256SUMS

export DEBIAN_FRONTEND=noninteractive
mapfile -t packages < <(find "$PAYLOAD_DIR/packages" -maxdepth 1 -type f -name '*.deb' -print | sort)
[[ "${#packages[@]}" -gt 0 ]] || die "offline package set is empty"
[[ -s "$PAYLOAD_DIR/packages/Packages.gz" ]] || die "offline APT index is missing"
offline_sources="$(mktemp)"
trap 'rm -f "$offline_sources"' EXIT
printf 'deb [trusted=yes] file:%s ./\n' "$PAYLOAD_DIR/packages" >"$offline_sources"
apt-get \
  -o "Dir::Etc::sourcelist=$offline_sources" \
  -o "Dir::Etc::sourceparts=-" \
  update
apt-get \
  -o "Dir::Etc::sourcelist=$offline_sources" \
  -o "Dir::Etc::sourceparts=-" \
  install -y \
  ca-certificates curl openssl apache2-utils nginx lightdm openbox \
  chromium unclutter systemd-resolved nftables openssh-server sudo \
  containerd.io docker-ce docker-ce-cli docker-buildx-plugin \
  docker-compose-plugin salt-common salt-minion
rm -f "$offline_sources"
trap - EXIT

apt-mark hold \
  containerd.io docker-ce docker-ce-cli docker-buildx-plugin \
  docker-compose-plugin salt-common salt-minion

systemctl enable --now docker.service
for image_archive in "$PAYLOAD_DIR"/images/*.tar; do
  [[ -f "$image_archive" ]] || die "Docker image archives are missing"
  docker load --input "$image_archive"
done

install -m 0600 "$PAYLOAD_DIR/factory.env" /etc/rinir-factory.env
bash "$PAYLOAD_DIR/app/deploy/debian/firstboot.sh"
bash "$PAYLOAD_DIR/app/deploy/debian/install-system.sh"

systemctl enable gas-monitoring.service gas-monitoring-acceptance.service \
  nginx.service lightdm.service salt-minion.service nftables.service ssh.service
install -d -m 0755 /var/lib/rinir-factory
touch /var/lib/rinir-factory/provision.done
systemctl disable factory-provision.service
systemctl reboot
