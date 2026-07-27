#!/usr/bin/env sh
set -eu

MONITOR_ID="$(node /opt/gas-monitoring/derive-monitor-id.cjs "${HOST_MACHINE_NAME:-}" "${HOST_HOSTNAME_FILE:-}")"
export MONITOR_ID

node /opt/gas-monitoring/render-runtime-flow.cjs
cp /opt/gas-monitoring/settings.js /data/settings.js

exec npm start -- --userDir /data --settings /data/settings.js
