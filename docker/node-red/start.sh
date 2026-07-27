#!/usr/bin/env sh
set -eu

node /opt/gas-monitoring/render-runtime-flow.cjs
cp /opt/gas-monitoring/settings.js /data/settings.js

exec npm start -- --userDir /data --settings /data/settings.js
