#!/usr/bin/env bash
set -euo pipefail

readonly CONFIG_FILE="${RINIR_FACTORY_CONFIG:-/etc/rinir-factory.env}"
readonly STATE_DIR="/var/lib/rinir-factory"
readonly NETWORK_DIR="/etc/systemd/network"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_root_debian_13_amd64() {
  [[ "$(id -u)" -eq 0 ]] || die "run as root"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "debian" && "${VERSION_ID:-}" == "13" ]] ||
    die "Debian 13 is required"
  [[ "$(dpkg --print-architecture)" == "amd64" ]] ||
    die "amd64 architecture is required"
}

load_config() {
  [[ -r "$CONFIG_FILE" ]] || die "missing $CONFIG_FILE"
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  : "${MANAGEMENT_DHCP:=true}"
  : "${MODBUS_ADDRESS:=192.168.50.1/24}"
  : "${MODBUS_DEVICE_ADDRESS:=192.168.50.10}"
  : "${SALT_MASTER:=}"
  [[ "$MANAGEMENT_DHCP" == "true" ]] ||
    die "only DHCP management LAN is supported"
  [[ "$MODBUS_ADDRESS" =~ ^[0-9.]+/[0-9]+$ ]] ||
    die "invalid MODBUS_ADDRESS"
}

physical_ethernet_interfaces() {
  local interface
  for interface_path in /sys/class/net/*; do
    interface="${interface_path##*/}"
    [[ "$interface" != "lo" ]] || continue
    [[ -e "$interface_path/device" ]] || continue
    [[ "$(cat "$interface_path/type")" == "1" ]] || continue
    printf '%s\n' "$interface"
  done | sort
}

select_interfaces() {
  mapfile -t detected_interfaces < <(physical_ethernet_interfaces)
  [[ "${#detected_interfaces[@]}" -eq 2 ]] ||
    die "exactly two physical Ethernet interfaces are required; found ${#detected_interfaces[@]}"

  : "${MANAGEMENT_INTERFACE:=${detected_interfaces[0]}}"
  : "${MODBUS_INTERFACE:=${detected_interfaces[1]}}"
  [[ "$MANAGEMENT_INTERFACE" != "$MODBUS_INTERFACE" ]] ||
    die "management and Modbus interfaces must differ"

  local candidate found
  for candidate in "$MANAGEMENT_INTERFACE" "$MODBUS_INTERFACE"; do
    found=false
    for interface in "${detected_interfaces[@]}"; do
      [[ "$candidate" == "$interface" ]] && found=true
    done
    [[ "$found" == "true" ]] || die "physical interface not found: $candidate"
  done
}

derive_hostname() {
  local source_value suffix
  if [[ -r /sys/class/dmi/id/product_uuid ]]; then
    source_value="$(tr -d '\r\n-' </sys/class/dmi/id/product_uuid)"
  else
    source_value="$(tr -d '\r\n-' </etc/machine-id)"
  fi
  source_value="${source_value^^}"
  [[ "$source_value" =~ ^[A-Z0-9]{6,}$ ]] ||
    die "cannot derive hostname suffix"
  suffix="${source_value: -6}"
  printf 'RINIR-%s\n' "$suffix"
}

write_network_configuration() {
  local management_mac modbus_mac
  management_mac="$(cat "/sys/class/net/$MANAGEMENT_INTERFACE/address")"
  modbus_mac="$(cat "/sys/class/net/$MODBUS_INTERFACE/address")"

  install -d -m 0755 "$NETWORK_DIR"
  cat >"$NETWORK_DIR/10-rinir-management.link" <<EOF
[Match]
MACAddress=$management_mac

[Link]
Name=rinir-mgmt
EOF
  cat >"$NETWORK_DIR/10-rinir-management.network" <<'EOF'
[Match]
Name=rinir-mgmt

[Network]
DHCP=yes
IPv6AcceptRA=yes

[DHCPv4]
RouteMetric=100
EOF
  cat >"$NETWORK_DIR/20-rinir-modbus.link" <<EOF
[Match]
MACAddress=$modbus_mac

[Link]
Name=rinir-modbus
EOF
  cat >"$NETWORK_DIR/20-rinir-modbus.network" <<EOF
[Match]
Name=rinir-modbus

[Network]
Address=$MODBUS_ADDRESS
DHCP=no
IPv6AcceptRA=no
LinkLocalAddressing=no
LLMNR=no
MulticastDNS=no
DNSDefaultRoute=no
EOF

  cat >/etc/network/interfaces <<'EOF'
# Сетевыми ролями управляет systemd-networkd.
auto lo
iface lo inet loopback
EOF
  systemctl disable networking.service >/dev/null 2>&1 || true
  systemctl enable systemd-networkd.service systemd-resolved.service
  ln -sfn /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
}

configure_salt() {
  install -d -m 0755 /etc/salt/minion.d
  if [[ -n "$SALT_MASTER" ]]; then
    printf 'master: %s\n' "$SALT_MASTER" >/etc/salt/minion.d/10-rinir-master.conf
  else
    rm -f /etc/salt/minion.d/10-rinir-master.conf
  fi
  printf '%s\n' "$rinir_hostname" >/etc/salt/minion_id
  systemctl enable salt-minion.service
}

main() {
  require_root_debian_13_amd64
  load_config
  select_interfaces
  install -d -m 0755 "$STATE_DIR"

  rinir_hostname="$(derive_hostname)"
  hostnamectl set-hostname "$rinir_hostname"
  if grep -qE '^127\.0\.1\.1[[:space:]]' /etc/hosts; then
    sed -i -E "s/^127\.0\.1\.1[[:space:]].*/127.0.1.1\t$rinir_hostname/" /etc/hosts
  else
    printf '127.0.1.1\t%s\n' "$rinir_hostname" >>/etc/hosts
  fi

  write_network_configuration
  configure_salt

  cat >"$STATE_DIR/firstboot.env" <<EOF
RINIR_HOSTNAME=$rinir_hostname
MANAGEMENT_INTERFACE_SOURCE=$MANAGEMENT_INTERFACE
MANAGEMENT_INTERFACE=rinir-mgmt
MODBUS_INTERFACE_SOURCE=$MODBUS_INTERFACE
MODBUS_INTERFACE=rinir-modbus
MODBUS_ADDRESS=$MODBUS_ADDRESS
MODBUS_DEVICE_ADDRESS=$MODBUS_DEVICE_ADDRESS
EOF
  chmod 0644 "$STATE_DIR/firstboot.env"
  touch "$STATE_DIR/firstboot.done"
  echo "Firstboot configured $rinir_hostname; reboot is required."
}

main "$@"
