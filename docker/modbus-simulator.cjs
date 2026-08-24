"use strict";

const http = require("node:http");
const ModbusRTU = require("@openp4nr/modbus-serial");

const registers = new Map([
    [5380, 50],
    [9476, 52],
    [13572, 48]
]);
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
    normal: { 5380: 50, 9476: 52, 13572: 48 },
    zero: { 5380: 0, 9476: 0, 13572: 0 },
    warning: { 5380: 38, 9476: 62, 13572: 39 },
    oxygenalarm: { 5380: 20, 9476: 52, 13572: 48 },
    alarm: { 5380: 20, 9476: 80, 13572: 70 },
    calibration4: { 5380: 0, 9476: 0, 13572: 0 },
    calibration12: { 5380: 80, 9476: 80, 13572: 80 },
    calibration20: { 5380: 160, 9476: 160, 13572: 160 },
    nodata: { 5380: 32767, 9476: 32767, 13572: 32767 }
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
    getInputRegister(address) {
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
    }
};

const modbus = new ModbusRTU.ServerTCP(vector, {
    host: "0.0.0.0",
    port: 502,
    unitID: Number(process.env.MODBUS_UNIT_ID || 65),
    debug: false
});

const control = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "pass", scenario: currentScenario, registers: Object.fromEntries(registers) }));
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
