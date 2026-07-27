FROM nodered/node-red:5.0.1-24@sha256:6cb1b27fa5a83deec6a662db62eec8bb32e55ac5412d6b7a653e874ce62055d5

USER root

COPY package.json /tmp/gas-monitoring-package.json

RUN node -e "\
const fs=require('fs');\
const target='/usr/src/node-red/package.json';\
const base=JSON.parse(fs.readFileSync(target));\
const extra=JSON.parse(fs.readFileSync('/tmp/gas-monitoring-package.json'));\
base.dependencies={...base.dependencies,...extra.dependencies};\
base.overrides={...base.overrides,...extra.overrides};\
fs.writeFileSync(target,JSON.stringify(base,null,2)+'\n');" \
    && cd /usr/src/node-red \
    && npm install --omit=dev --no-audit --no-fund \
    && rm /tmp/gas-monitoring-package.json

COPY --chown=node-red:node-red flows/flows.json /opt/gas-monitoring/flows.json
COPY --chown=node-red:node-red config/settings.example.js /opt/gas-monitoring/settings.js
COPY --chown=node-red:node-red docker/node-red/start.sh /opt/gas-monitoring/start.sh
COPY --chown=node-red:node-red docker/modbus-simulator.cjs /opt/gas-monitoring/modbus-simulator.cjs
COPY --chown=node-red:node-red docker/render-runtime-flow.cjs /opt/gas-monitoring/render-runtime-flow.cjs

RUN chmod 0555 /opt/gas-monitoring/start.sh

USER node-red

ENTRYPOINT ["/opt/gas-monitoring/start.sh"]
