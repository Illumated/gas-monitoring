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

docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node \
  --volume /etc/gas-monitoring:/config \
  --volume "$STATE_DIR:/evidence" \
  gas-monitoring-node-red:0.1.0 \
  /usr/src/node-red/tools/wb-autoconfigure.mjs \
  --apply --host "${MODBUS_HOST:-192.168.50.10}" --port "${MODBUS_PORT:-502}" \
  --env-file /config/gas-monitoring.env --evidence /evidence

touch "$DONE_FILE"
