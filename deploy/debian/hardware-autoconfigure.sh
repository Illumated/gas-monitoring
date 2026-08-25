#!/usr/bin/env bash
set -euo pipefail

readonly STATE_DIR=/var/lib/rinir-factory/commissioning
readonly DONE_FILE="$STATE_DIR/hardware-autoconfigure.done"
readonly ENV_FILE=/etc/gas-monitoring/gas-monitoring.env

install -d -m 0755 "$STATE_DIR"
[[ -e "$DONE_FILE" ]] && exit 0
# shellcheck disable=SC1090
source "$ENV_FILE"

docker run --rm --network host --user 0:0 --cap-drop ALL --security-opt no-new-privileges:true \
  --volume /etc/gas-monitoring:/config \
  --volume "$STATE_DIR:/evidence" \
  gas-monitoring-node-red:0.1.0 \
  node /usr/src/node-red/tools/wb-autoconfigure.mjs \
  --apply --host "${MODBUS_HOST:-192.168.50.10}" --port "${MODBUS_PORT:-502}" \
  --env-file /config/gas-monitoring.env --evidence /evidence

touch "$DONE_FILE"
