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

function requiredText(name, maxLength) {
    const value = String(process.env[name] || "").trim();
    if (!value || value.length > maxLength || /[\r\n]/.test(value)) {
        throw new Error(`${name} must be a non-empty single-line value up to ${maxLength} characters`);
    }
    return value;
}

const monitorId = requiredText("MONITOR_ID", 12);
if (!/^RINIR-[A-Z0-9]{6}$/.test(monitorId)) {
    throw new Error("MONITOR_ID must match RINIR-XXXXXX");
}

const host = process.env.MODBUS_HOST || "192.168.50.10";
if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    throw new Error("MODBUS_HOST contains unsupported characters");
}

const port = integer("MODBUS_PORT", 502, 1, 65535);
const unitId = integer("MODBUS_UNIT_ID", 65, 1, 247);
const pollMs = integer("MODBUS_POLL_INTERVAL_MS", 2000, 500, 3600000);
const commandDelayMs = integer("MODBUS_COMMAND_DELAY_MS", 300, 1, 10000);
const staleMs = integer("GAS_STALE_TIMEOUT_MS", 6000, 1500, 3600000);

const sequenceCount = 6;
if (commandDelayMs * sequenceCount >= pollMs) {
    throw new Error(`MODBUS_COMMAND_DELAY_MS * ${sequenceCount} must be less than MODBUS_POLL_INTERVAL_MS`);
}
if (staleMs < pollMs * 3) {
    throw new Error("GAS_STALE_TIMEOUT_MS must be at least MODBUS_POLL_INTERVAL_MS * 3");
}

const client = flow.find((node) => node.id === "cfg-modbus-tcp");
if (!client) {
    throw new Error("cfg-modbus-tcp is missing");
}
client.tcpHost = host;
client.tcpPort = String(port);
client.unit_id = unitId;
client.commandDelay = String(commandDelayMs);

const pollCycle = flow.find((node) => node.id === "poll-cycle");
const pollBuilder = flow.find((node) => node.id === "poll-builder");
const pollDelay = flow.find((node) => node.id === "poll-delay");
const pollGetter = flow.find((node) => node.id === "poll-getter");
if (!pollCycle || !pollBuilder || !pollDelay || !pollGetter) {
    throw new Error("dynamic polling nodes are missing");
}
pollCycle.repeat = String(pollMs / 1000);
pollDelay.nbRateUnits = String(commandDelayMs / 1000);
pollDelay.rateUnits = "second";

fs.writeFileSync(target, JSON.stringify(flow, null, 2) + "\n");
