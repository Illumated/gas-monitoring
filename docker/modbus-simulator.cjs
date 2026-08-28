"use strict";

const http = require("node:http");
const ModbusRTU = require("@openp4nr/modbus-serial");

const registers = new Map([[25860, 1]]);
const gasRegisters = [5376, 9472, 13568, 17664, 21760];
function setCurrent(address, milliamps) {
    const nanoamps = Math.round(milliamps * 1_000_000) >>> 0;
    registers.set(address, nanoamps >>> 16);
    registers.set(address + 1, nanoamps & 0xffff);
}
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

const scenario = (pressures, valveFeedback = 1) => ({ pressures, valveFeedback });
const scenarios = {
    normal: scenario([5, 5.2, 4.8, 5, 5]),
    zero: scenario([0, 0, 0, 0, 0]),
    warning: scenario([3.8, 6.2, 3.9, 6.2, 3.9]),
    oxygenalarm: scenario([2, 5.2, 4.8, 5, 5], 0),
    alarm: scenario([2, 8, 7, 2, 8], 0),
    valvealarm: scenario([5, 5.2, 4.8, 5, 5], 0),
    calibration4: { currents: [4, 4, 4, 4, 4], valveFeedback: 1 },
    calibration12: { currents: [12, 12, 12, 12, 12], valveFeedback: 1 },
    calibration20: { currents: [20, 20, 20, 20, 20], valveFeedback: 1 },
    nodata: { currents: [0, 0, 0, 0, 0], valveFeedback: 32767 }
};
let currentScenario = "normal";

function apply(values) {
    const currents = values.currents || values.pressures.map((pressure) => 4 + pressure * 1.6);
    if (!Array.isArray(currents) || currents.length !== gasRegisters.length || currents.some((value) => !Number.isFinite(value))) {
        throw new Error("invalid gas current scenario");
    }
    gasRegisters.forEach((address, index) => setCurrent(address, currents[index]));
    registers.set(25860, values.valveFeedback);
}

apply(scenarios.normal);

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
