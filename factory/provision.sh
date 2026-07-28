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
apt-get install -y --no-download "${packages[@]}"

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

systemctl enable gas-monitoring.service nginx.service lightdm.service salt-minion.service nftables.service
install -d -m 0755 /var/lib/rinir-factory
touch /var/lib/rinir-factory/provision.done
systemctl disable factory-provision.service
systemctl reboot
