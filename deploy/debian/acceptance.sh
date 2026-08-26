#!/usr/bin/env bash
set -euo pipefail

readonly STATE_FILE="/var/lib/rinir-factory/firstboot.env"
readonly REPORT_DIR="/var/lib/rinir-factory/acceptance"
REPORT_FILE="$REPORT_DIR/$(date -u +%Y%m%dT%H%M%SZ).txt"
readonly REPORT_FILE

pass() {
  printf 'PASS: %s\n' "$*"
}

check_service() {
  systemctl is-enabled --quiet "$1"
  systemctl is-active --quiet "$1"
  pass "$1 is enabled and active"
}

wait_http() {
  local url="$1"
  for _ in $(seq 1 90); do
    if curl --fail --silent --output /dev/null "$url"; then
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root" >&2
  exit 1
}
install -d -m 0755 "$REPORT_DIR"
exec > >(tee "$REPORT_FILE") 2>&1

# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "debian" && "${VERSION_ID:-}" == "13" ]]
[[ "$(dpkg --print-architecture)" == "amd64" ]]
pass "Debian 13 amd64"

hostname_value="$(hostnamectl --static)"
[[ "$hostname_value" =~ ^RINIR-[A-Z0-9]{6}$ ]]
pass "hostname $hostname_value"

[[ -r "$STATE_FILE" ]]
# shellcheck disable=SC1090
source "$STATE_FILE"
[[ -d /sys/class/net/rinir-mgmt ]]
[[ -d /sys/class/net/rinir-modbus ]]
ip -4 address show dev rinir-mgmt | grep -q 'inet '
ip -4 address show dev rinir-modbus | grep -q "inet ${MODBUS_ADDRESS%/*}/"
if ip route show default | grep -q 'dev rinir-modbus'; then
  echo "Modbus interface must not have a default route" >&2
  exit 1
fi
pass "management DHCP and isolated Modbus network"

check_service docker.service
check_service salt-minion.service
check_service gas-monitoring.service
check_service nginx.service
check_service lightdm.service
check_service nftables.service
check_service ssh.service

id rinir >/dev/null
id -nG rinir | tr ' ' '\n' | grep -qx sudo
sshd -T | grep -qx 'permitrootlogin no'
sshd -T | grep -qx 'passwordauthentication yes'
pass "SSH maintenance user and policy"

wait_http http://127.0.0.1:1880/dashboard/monitoring
wait_http http://127.0.0.1:8086/health
wait_http http://127.0.0.1:18082/health
[[ "$(curl --insecure --output /dev/null --write-out '%{http_code}' https://127.0.0.1/)" == "401" ]]
pass "local dashboard, InfluxDB, auth-service and authenticated HTTPS gateway"

if ss -lnt | awk 'NR > 1 {print $4}' | grep -Eq '(^|[^0-9])0\.0\.0\.0:(1880|8086)$|^\[::\]:(1880|8086)$'; then
  echo "Node-RED or InfluxDB is exposed outside loopback" >&2
  exit 1
fi
pass "Node-RED and InfluxDB remain loopback-only"

docker compose \
  --env-file /etc/gas-monitoring/gas-monitoring.env \
  -f /opt/gas-monitoring/docker/compose.yaml \
  -f /opt/gas-monitoring/docker/compose.production.yaml \
  ps
pass "factory acceptance completed; report $REPORT_FILE"
