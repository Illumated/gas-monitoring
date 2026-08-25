"use strict";

const http = require("node:http");
const ModbusRTU = require("@openp4nr/modbus-serial");

const registers = new Map([
    [5380, 50],
    [9476, 52],
    [13572, 48],
    [17668, 50],
    [21764, 50],
    [25860, 1]
]);
const relayCoils = new Map([[0, false], [1, false], [2, false]]);
function setInputString(address, count, value) {
    const bytes = Buffer.alloc(count * 2);
    bytes.write(value, 0, "utf8");
    for (let index = 0; index < count; index += 1) {
        registers.set(address + index, bytes.readUInt16BE(index * 2));
    }
}
setInputString(200, 20, "WB-MAI6-SIM");
setInputString(220, 25, "software-fat");
setInputString(250, 16, "0.0.0-sim");
registers.set(266, 0);
registers.set(267, 0);
registers.set(268, 0);
registers.set(269, 1);
registers.set(270, 0);
registers.set(271, 1);

const holdingRegisters = new Map();
holdingRegisters.set(110, 96);
holdingRegisters.set(111, 0);
holdingRegisters.set(112, 1);
holdingRegisters.set(113, 5);
holdingRegisters.set(114, 0);
holdingRegisters.set(128, Number(process.env.MODBUS_UNIT_ID || 65));
for (let channel = 1; channel <= 6; channel += 1) {
    const base = 4096 * channel;
    for (const sideOffset of [0, 1]) {
        holdingRegisters.set(base + 1024 + sideOffset, 0);
        holdingRegisters.set(base + 1032 + sideOffset, 0);
        holdingRegisters.set(base + 1034 + sideOffset, 10000);
    }
}

const scenarios = {
    normal: { 5380: 50, 9476: 52, 13572: 48, 17668: 50, 21764: 50, 25860: 1 },
    zero: { 5380: 0, 9476: 0, 13572: 0, 17668: 0, 21764: 0, 25860: 1 },
    warning: { 5380: 38, 9476: 62, 13572: 39, 17668: 62, 21764: 39, 25860: 1 },
    oxygenalarm: { 5380: 20, 9476: 52, 13572: 48, 17668: 50, 21764: 50, 25860: 0 },
    alarm: { 5380: 20, 9476: 80, 13572: 70, 17668: 20, 21764: 80, 25860: 0 },
    valvealarm: { 5380: 50, 9476: 52, 13572: 48, 17668: 50, 21764: 50, 25860: 0 },
    calibration4: { 5380: 0, 9476: 0, 13572: 0, 17668: 0, 21764: 0 },
    calibration12: { 5380: 50, 9476: 50, 13572: 50, 17668: 50, 21764: 50 },
    calibration20: { 5380: 100, 9476: 100, 13572: 100, 17668: 100, 21764: 100 },
    nodata: { 5380: 32767, 9476: 32767, 13572: 32767, 17668: 32767, 21764: 32767, 25860: 32767 }
};
let currentScenario = "normal";

function apply(values) {
    for (const [address, value] of Object.entries(values)) {
        const parsedAddress = Number(address);
        const parsedValue = Number(value);
        if (!registers.has(parsedAddress) || !Number.isInteger(parsedValue) || parsedValue < -32768 || parsedValue > 32767) {
            throw new Error(`invalid register value ${address}=${value}`);
        }
        registers.set(parsedAddress, parsedValue);
    }
}

const vector = {
    getInputRegister(address, unitID) {
        if (unitID !== Number(process.env.MODBUS_UNIT_ID || 65)) return 0;
        return registers.get(address) ?? 32767;
    },
    getHoldingRegister(address) {
        return holdingRegisters.get(address) ?? 0;
    },
    setRegister(address, value) {
        if (!holdingRegisters.has(address)) {
            throw new Error(`unsupported holding register ${address}`);
        }
        holdingRegisters.set(address, value);
    },
    getCoil(address, unitID) {
        if (unitID !== Number(process.env.VALVE_RELAY_UNIT_ID || 66)) return false;
        return relayCoils.get(address) ?? false;
    },
    setCoil(address, value, unitID) {
        if (unitID !== Number(process.env.VALVE_RELAY_UNIT_ID || 66) || !relayCoils.has(address)) {
            throw new Error(`unsupported relay coil ${unitID}:${address}`);
        }
        relayCoils.set(address, Boolean(value));
    }
};

const modbus = new ModbusRTU.ServerTCP(vector, {
    host: "0.0.0.0",
    port: 502,
    unitID: 255,
    debug: false
});

const control = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "pass", scenario: currentScenario, registers: Object.fromEntries(registers), relayCoils: Object.fromEntries(relayCoils) }));
        return;
    }

    const match = request.method === "POST" && request.url?.match(/^\/scenario\/([a-z0-9]+)$/);
    if (match && scenarios[match[1]]) {
        apply(scenarios[match[1]]);
        currentScenario = match[1];
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "applied", scenario: currentScenario, registers: Object.fromEntries(registers) }));
        return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "unknown endpoint" }));
});

control.listen(8080, "0.0.0.0");

function shutdown() {
    control.close();
    modbus.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
