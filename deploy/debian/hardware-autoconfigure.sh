#!/usr/bin/env bash
set -euo pipefail

readonly STATE_DIR=/var/lib/rinir-factory/commissioning
readonly DONE_FILE="$STATE_DIR/hardware-autoconfigure.done"
readonly ENV_FILE=/etc/gas-monitoring/gas-monitoring.env

install -d -m 0755 "$STATE_DIR"
[[ -e "$DONE_FILE" ]] && exit 0

read_env_value() {
  local name="$1"
  sed -n "s/^${name}=//p" "$ENV_FILE" | tail -n 1
}

MODBUS_HOST="$(read_env_value MODBUS_HOST)"
MODBUS_PORT="$(read_env_value MODBUS_PORT)"
readonly FACTORY_GATEWAY_HOST=192.168.0.7
readonly FACTORY_SERVICE_ADDRESS=192.168.0.1/24
readonly MODBUS_INTERFACE=rinir-modbus
gateway_host="${MODBUS_HOST:-192.168.50.10}"

cleanup() {
  ip address del "$FACTORY_SERVICE_ADDRESS" dev "$MODBUS_INTERFACE" 2>/dev/null || true
}
trap cleanup EXIT

# Временный адрес нужен только для обнаружения USR-DR134 с заводским IPv4.
ip address add "$FACTORY_SERVICE_ADDRESS" dev "$MODBUS_INTERFACE" 2>/dev/null || true

gateway_read() {
  local host="$1"
  docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
    --entrypoint node --env-file "$ENV_FILE" \
    gas-monitoring-node-red:0.1.0 \
    /usr/src/node-red/tools/usr-dr134-config.mjs --host "$host" >/dev/null 2>&1
}

source_gateway=""
for candidate in "$gateway_host" "$FACTORY_GATEWAY_HOST"; do
  if gateway_read "$candidate"; then
    source_gateway="$candidate"
    break
  fi
done
[[ -n "$source_gateway" ]] || {
  echo "ERROR: USR-DR134 не найден по рабочему или заводскому адресу" >&2
  exit 1
}

# На 9600 8N2 доступны новые WB-устройства с заводским UART-профилем.
docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node --env-file "$ENV_FILE" \
  gas-monitoring-node-red:0.1.0 \
  /usr/src/node-red/tools/usr-dr134-config.mjs \
  --apply --confirm APPLY --host "$source_gateway" --target-host "$gateway_host" --baud 9600

for _ in {1..30}; do
  gateway_read "$gateway_host" && break
  sleep 2
done
gateway_read "$gateway_host" || {
  echo "ERROR: USR-DR134 не отвечает после применения сетевого профиля" >&2
  exit 1
}

docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node \
  --env-file "$ENV_FILE" \
  --volume /etc/gas-monitoring:/config \
  --volume "$STATE_DIR:/evidence" \
  gas-monitoring-node-red:0.1.0 \
  /usr/src/node-red/tools/wb-autoconfigure.mjs \
  --apply --host "${MODBUS_HOST:-192.168.50.10}" --port "${MODBUS_PORT:-502}" \
  --env-file /config/gas-monitoring.env --evidence /evidence

# После перевода всех WB-устройств шлюз возвращается на рабочий профиль.
docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node --env-file "$ENV_FILE" \
  gas-monitoring-node-red:0.1.0 \
  /usr/src/node-red/tools/usr-dr134-config.mjs \
  --apply --confirm APPLY --host "$gateway_host" --target-host "$gateway_host" --baud 115200

sleep 3
docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node --env-file "$ENV_FILE" \
  --volume /etc/gas-monitoring:/config \
  --volume "$STATE_DIR:/evidence" \
  gas-monitoring-node-red:0.1.0 \
  /usr/src/node-red/tools/wb-autoconfigure.mjs \
  --verify-only --host "$gateway_host" --port "${MODBUS_PORT:-502}" \
  --env-file /config/gas-monitoring.env --evidence /evidence

touch "$DONE_FILE"
