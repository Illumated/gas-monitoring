#!/usr/bin/env sh
set -eu

cp /opt/gas-monitoring/flows.json /data/flows.json
cp /opt/gas-monitoring/settings.js /data/settings.js

exec npm start -- --userDir /data --settings /data/settings.js
