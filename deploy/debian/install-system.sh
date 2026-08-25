#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly SOURCE_DIR
readonly CONFIG_FILE="${RINIR_FACTORY_CONFIG:-/etc/rinir-factory.env}"
readonly APP_DIR="/opt/gas-monitoring"
readonly APP_CONFIG_DIR="/etc/gas-monitoring"
readonly CREDENTIALS_FILE="$APP_CONFIG_DIR/factory-credentials.txt"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

random_secret() {
  openssl rand -base64 "$1" | tr -d '\r\n'
}

require_target() {
  [[ "$(id -u)" -eq 0 ]] || die "run as root"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "debian" && "${VERSION_ID:-}" == "13" ]] ||
    die "Debian 13 is required"
  [[ "$(dpkg --print-architecture)" == "amd64" ]] ||
    die "amd64 architecture is required"
  [[ -r "$CONFIG_FILE" ]] || die "missing $CONFIG_FILE"
  command -v docker >/dev/null || die "Docker Engine is not installed"
  command -v salt-minion >/dev/null || die "salt-minion is not installed"
  command -v chromium >/dev/null || die "Chromium is not installed"
  command -v nginx >/dev/null || die "nginx is not installed"
}

load_factory_config() {
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  : "${TZ:=Europe/Moscow}"
  : "${INFLUXDB_RETENTION:=8760h}"
  : "${REMOTE_USER:=operator}"
  : "${REMOTE_HTTPS_PORT:=443}"
  : "${ADMIN_ACCESS_CODE:=}"
  : "${NODE_RED_ADMIN_PASSWORD:=}"
  : "${REMOTE_INITIAL_PASSWORD:=}"
  [[ "$REMOTE_USER" =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid REMOTE_USER"
  [[ "$REMOTE_HTTPS_PORT" == "443" ]] ||
    die "REMOTE_HTTPS_PORT currently must be 443"
  [[ "$ADMIN_ACCESS_CODE" != replace-with-* && ${#ADMIN_ACCESS_CODE} -ge 10 ]] ||
    die "set a unique ADMIN_ACCESS_CODE with at least 10 characters"
  [[ "$NODE_RED_ADMIN_PASSWORD" != replace-with-* && ${#NODE_RED_ADMIN_PASSWORD} -ge 12 ]] ||
    die "set a unique NODE_RED_ADMIN_PASSWORD with at least 12 characters"
  [[ "$REMOTE_INITIAL_PASSWORD" != replace-with-* && ${#REMOTE_INITIAL_PASSWORD} -ge 10 ]] ||
    die "set a unique REMOTE_INITIAL_PASSWORD with at least 10 characters"
  [[ "$ADMIN_ACCESS_CODE" =~ ^[A-Za-z0-9._@+-]+$ ]] ||
    die "ADMIN_ACCESS_CODE contains unsupported characters"
  [[ "$NODE_RED_ADMIN_PASSWORD" =~ ^[A-Za-z0-9._@+-]+$ ]] ||
    die "NODE_RED_ADMIN_PASSWORD contains unsupported characters"
  [[ "$REMOTE_INITIAL_PASSWORD" =~ ^[A-Za-z0-9._@+-]+$ ]] ||
    die "REMOTE_INITIAL_PASSWORD contains unsupported characters"
}

install_application_files() {
  install -d -m 0755 "$APP_DIR"
  cp -a "$SOURCE_DIR/." "$APP_DIR/"
  install -d -m 0700 "$APP_CONFIG_DIR" "$APP_CONFIG_DIR/tls"
}

generate_application_config() {
  [[ ! -e "$APP_CONFIG_DIR/gas-monitoring.env" ]] ||
    return 0

  local influx_password influx_token credential_secret admin_code auth_service_token
  local admin_password admin_hash remote_password
  influx_password="$(random_secret 36)"
  influx_token="$(random_secret 48)"
  credential_secret="$(random_secret 48)"
  admin_code="$ADMIN_ACCESS_CODE"
  auth_service_token="$(random_secret 48)"
  admin_password="$NODE_RED_ADMIN_PASSWORD"
  remote_password="$REMOTE_INITIAL_PASSWORD"
  admin_hash="$(htpasswd -bnBC 10 "" "$admin_password" | cut -d: -f2 | tr -d '\r\n')"
  admin_hash="${admin_hash/\$2y\$/\$2b\$}"

  cat >"$APP_CONFIG_DIR/gas-monitoring.env" <<EOF
COMPOSE_PROJECT_NAME=gas-monitoring
TZ=$TZ
NODE_RED_PORT=1880
NODE_RED_CREDENTIAL_SECRET=$credential_secret
NODE_RED_ADMIN_USER=admin
NODE_RED_ADMIN_PASSWORD_HASH=$admin_hash
SERVICE_ACCESS_CODE=
ADMIN_ACCESS_CODE=$admin_code
SERVICE_UNLOCK_MINUTES=15
AUTH_SERVICE_TOKEN=$auth_service_token
AUTH_SERVICE_PORT=18082
REMOTE_INITIAL_USER=${REMOTE_USER,,}
REMOTE_INITIAL_PASSWORD=$remote_password
MODBUS_HOST=${MODBUS_DEVICE_ADDRESS:-192.168.50.10}
MODBUS_PORT=502
MODBUS_UNIT_ID=65
VALVE_RELAY_UNIT_ID=66
MODBUS_POLL_INTERVAL_MS=2000
MODBUS_COMMAND_DELAY_MS=300
GAS_STALE_TIMEOUT_MS=6000
GAS_HYSTERESIS_BAR=0.1
GAS_DISPLAY_MAX_BAR=10
OXYGEN_WARN_LOW_BAR=3.5
OXYGEN_OK_LOW_BAR=4
OXYGEN_OK_HIGH_BAR=6
OXYGEN_WARN_HIGH_BAR=6.5
AIR_WARN_LOW_BAR=3.5
AIR_OK_LOW_BAR=4
AIR_OK_HIGH_BAR=6
AIR_WARN_HIGH_BAR=6.5
N2O_WARN_LOW_BAR=3.5
N2O_OK_LOW_BAR=4
N2O_OK_HIGH_BAR=6
N2O_WARN_HIGH_BAR=6.5
VACUUM_WARN_LOW_BAR=3.5
VACUUM_OK_LOW_BAR=4
VACUUM_OK_HIGH_BAR=6
VACUUM_WARN_HIGH_BAR=6.5
CO2_WARN_LOW_BAR=3.5
CO2_OK_LOW_BAR=4
CO2_OK_HIGH_BAR=6
CO2_WARN_HIGH_BAR=6.5
MAX_NOTIFICATIONS_ENABLED=false
MAX_API_URL=https://platform-api2.max.ru
MAX_BOT_TOKEN=
MAX_CHAT_ID=
MAX_REMINDER_INTERVAL_MINUTES=30
MAX_RETRY_COUNT=2
INFLUXDB_PORT=8086
INFLUXDB_USERNAME=admin
INFLUXDB_PASSWORD=$influx_password
INFLUXDB_ORG=rinir
INFLUXDB_BUCKET=wb
INFLUXDB_TOKEN=$influx_token
INFLUXDB_RETENTION=$INFLUXDB_RETENTION
EOF
  chmod 0600 "$APP_CONFIG_DIR/gas-monitoring.env"

  cat >"$CREDENTIALS_FILE" <<EOF
Admin access code: $admin_code
Node-RED editor user: admin
Node-RED editor password: $admin_password
Remote URL: https://$(hostnamectl --static)/
Remote user: ${REMOTE_USER,,}
Remote password: $remote_password
EOF
  chmod 0600 "$CREDENTIALS_FILE"
}

generate_remote_access() {
  local hostname_value
  hostname_value="$(hostnamectl --static)"
  [[ "$hostname_value" =~ ^RINIR-[A-Z0-9]{6}$ ]] ||
    die "hostname must match RINIR-XXXXXX"

  if [[ ! -s "$APP_CONFIG_DIR/tls/device.key" ]]; then
    openssl req -x509 -newkey rsa:3072 -nodes -days 825 \
      -subj "/CN=$hostname_value" \
      -addext "subjectAltName=DNS:$hostname_value" \
      -keyout "$APP_CONFIG_DIR/tls/device.key" \
      -out "$APP_CONFIG_DIR/tls/device.crt"
  fi
  chmod 0600 "$APP_CONFIG_DIR/tls/device.key"
  chmod 0644 "$APP_CONFIG_DIR/tls/device.crt"
}

configure_kiosk() {
  if ! id rinir-kiosk >/dev/null 2>&1; then
    useradd --system --create-home --home-dir /var/lib/rinir-kiosk \
      --shell /usr/sbin/nologin rinir-kiosk
  fi
  if getent group autologin >/dev/null; then
    usermod --append --groups autologin rinir-kiosk
  fi
  install -d -o rinir-kiosk -g rinir-kiosk -m 0700 \
    /var/lib/rinir-kiosk/.config/openbox
  cat >/var/lib/rinir-kiosk/.config/openbox/autostart <<'EOF'
xset -dpms
xset s off
xset s noblank
unclutter -idle 0.5 -root &
systemctl --user start gas-monitoring-kiosk.service
EOF
  chown rinir-kiosk:rinir-kiosk /var/lib/rinir-kiosk/.config/openbox/autostart

  install -d -m 0755 /etc/lightdm/lightdm.conf.d
  cat >/etc/lightdm/lightdm.conf.d/50-rinir-kiosk.conf <<'EOF'
[Seat:*]
autologin-user=rinir-kiosk
autologin-user-timeout=0
user-session=openbox
xserver-command=X -s 0 -dpms -nocursor
EOF

  install -d -o rinir-kiosk -g rinir-kiosk -m 0700 \
    /var/lib/rinir-kiosk/.config/systemd/user
  install -m 0644 "$SOURCE_DIR/deploy/debian/gas-monitoring-kiosk.service" \
    /var/lib/rinir-kiosk/.config/systemd/user/gas-monitoring-kiosk.service
  chown rinir-kiosk:rinir-kiosk \
    /var/lib/rinir-kiosk/.config/systemd/user/gas-monitoring-kiosk.service
}

install_services() {
  install -d -m 0755 /etc/systemd/system/docker.service.d
  cat >/etc/systemd/system/docker.service.d/10-rinir-firewall.conf <<'EOF'
[Unit]
Requires=nftables.service
After=nftables.service
EOF
  install -m 0644 "$SOURCE_DIR/deploy/debian/gas-monitoring.service" \
    /etc/systemd/system/gas-monitoring.service
  install -m 0644 "$SOURCE_DIR/deploy/debian/gas-monitoring-acceptance.service" \
    /etc/systemd/system/gas-monitoring-acceptance.service
  install -m 0644 "$SOURCE_DIR/deploy/debian/gas-monitoring-hardware-autoconfigure.service" \
    /etc/systemd/system/gas-monitoring-hardware-autoconfigure.service
  chmod 0755 "$APP_DIR/deploy/debian/hardware-autoconfigure.sh"
  install -m 0644 "$SOURCE_DIR/deploy/debian/nginx-gas-monitoring.conf" \
    /etc/nginx/sites-available/gas-monitoring
  install -m 0755 "$SOURCE_DIR/deploy/debian/nftables.conf" /etc/nftables.conf
  ln -sfn /etc/nginx/sites-available/gas-monitoring \
    /etc/nginx/sites-enabled/gas-monitoring
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl daemon-reload
  systemctl enable docker.service salt-minion.service lightdm.service
  systemctl enable gas-monitoring.service gas-monitoring-acceptance.service \
    gas-monitoring-hardware-autoconfigure.service \
    nginx.service nftables.service
}

main() {
  require_target
  load_factory_config
  install_application_files
  generate_application_config
  generate_remote_access
  configure_kiosk
  install_services
  echo "System installation completed. Credentials: $CREDENTIALS_FILE"
}

main "$@"
