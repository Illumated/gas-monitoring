"use strict";

const fs = require("node:fs");

const source = process.argv[2] || "/opt/gas-monitoring/flows.json";
const target = process.argv[3] || "/data/flows.json";
const flow = JSON.parse(fs.readFileSync(source, "utf8"));

function integer(name, fallback, min, max) {
    const raw = process.env[name] ?? String(fallback);
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer in ${min}..${max}`);
    }
    return value;
}

const host = process.env.MODBUS_HOST || "192.168.50.10";
if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    throw new Error("MODBUS_HOST contains unsupported characters");
}

const port = integer("MODBUS_PORT", 502, 1, 65535);
const unitId = integer("MODBUS_UNIT_ID", 65, 1, 247);
const pollMs = integer("MODBUS_POLL_INTERVAL_MS", 5000, 250, 3600000);

const client = flow.find((node) => node.id === "cfg-modbus-tcp");
if (!client) {
    throw new Error("cfg-modbus-tcp is missing");
}
client.tcpHost = host;
client.tcpPort = String(port);
client.unit_id = unitId;

for (const node of flow.filter((item) => item.type === "modbus-read")) {
    node.unitid = String(unitId);
    node.rate = String(pollMs);
    node.rateUnit = "ms";
}

fs.writeFileSync(target, JSON.stringify(flow, null, 2) + "\n");
