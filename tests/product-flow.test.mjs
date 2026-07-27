import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nodes = JSON.parse(await readFile(new URL("../flows/flows.json", import.meta.url), "utf8"));
const byId = new Map(nodes.map((node) => [node.id, node]));

for (const node of nodes.filter((item) => item.type === "function")) {
    assert.doesNotThrow(
        () => new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", node.func),
        `function node "${node.name}" must compile`
    );
}

const legacyTypes = new Set(["ui_base", "ui-gauge", "ui-chart", "influxdb", "influxdb in", "influxdb out"]);
assert.deepEqual(
    nodes.filter((node) => legacyTypes.has(node.type)).map((node) => node.id),
    [],
    "product flow must not contain legacy Dashboard or credential-bound InfluxDB nodes"
);

const client = byId.get("cfg-modbus-tcp");
assert.equal(client.clienttype, "tcp");
assert.equal(client.tcpHost, "${MODBUS_HOST}");
assert.equal(client.tcpPort, "${MODBUS_PORT}");
assert.equal(client.unit_id, 65);
assert.equal(client.serialBaudrate, "9600");
assert.equal(client.serialDatabits, "8");
assert.equal(client.serialStopbits, "1");
assert.equal(client.serialParity, "none");

const expectedRegisters = new Map([
    ["oxygen", "5380"],
    ["air", "9476"],
    ["n2o", "13572"]
]);
const reads = nodes.filter((node) => node.type === "modbus-read");
assert.equal(reads.length, expectedRegisters.size);
for (const read of reads) {
    assert.equal(read.dataType, "InputRegister");
    assert.equal(read.unitid, "65");
    assert.equal(read.adr, expectedRegisters.get(read.topic));
    assert.equal(read.quantity, "1");
    assert.equal(read.server, client.id);
}

const normalize = byId.get("fn-normalize");
const normalizeFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", normalize.func);
const nodeMock = { staleTimers: new Map(), send() {} };
const contextMock = { get() {}, set() {} };
const envMock = { get(name) { return name === "GAS_STALE_TIMEOUT_MS" ? "20000" : ""; } };
const timerMock = () => ({ testTimer: true });

for (const [raw, value, status] of [
    [0, 0, "alarm"],
    [35, 3.5, "warn"],
    [40, 4, "ok"],
    [60, 6, "ok"],
    [65, 6.5, "warn"],
    [66, 6.6, "alarm"]
]) {
    const result = normalizeFn(
        { topic: "oxygen", payload: { data: [raw] } },
        nodeMock,
        contextMock,
        envMock,
        timerMock,
        () => {}
    );
    assert.equal(result[0].payload.value, value);
    assert.equal(result[0].payload.status, status);
    assert.equal(result[1].payload.value, value);
}

for (const raw of [32767, -32768, Number.NaN]) {
    const result = normalizeFn(
        { topic: "air", payload: { data: [raw] } },
        nodeMock,
        contextMock,
        envMock,
        timerMock,
        () => {}
    );
    assert.equal(result[0].payload.status, "nodata");
    assert.equal(result[0].payload.value, null);
    assert.equal(result[1], null);
}

const stateNode = byId.get("fn-state");
const stateFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", stateNode.func);
let persistedState = {
    oxygen: { key: "oxygen", code: "O₂", name: "Кислород", value: 5, status: "ok", updatedAt: Date.now() - 30000 },
    air: { key: "air", code: "AIR", name: "Медицинский воздух", value: null, status: "nodata", updatedAt: null },
    n2o: { key: "n2o", code: "N₂O", name: "Закись азота", value: null, status: "nodata", updatedAt: null }
};
const stateContext = {
    get() { return persistedState; },
    set(_key, value) { persistedState = value; }
};
const staleResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(staleResult.payload.gases[0].value, null, "old persisted value must not remain visible");
assert.equal(staleResult.payload.gases[0].status, "nodata", "old persisted value must become nodata");

assert.equal(nodes.filter((node) => node.type === "http request").length, 2);
assert.equal(byId.get("cfg-ui-base").path, "/dashboard");
assert.equal(byId.get("cfg-page-monitor").path, "/monitoring");
assert.equal(byId.get("cfg-page-history").path, "/history");
assert.match(byId.get("ui-monitor").format, /box-sizing:border-box/, "desktop HMI must include padding in its viewport height");
assert.match(byId.get("ui-monitor").format, /grid-template-rows:auto minmax\(0,1fr\) auto/, "desktop HMI must distribute free height between header, cards and footer");
assert.match(byId.get("ui-monitor").format, /\.nrdb-ui-group\.gm-group \.gm-widget/, "FlowFuse widget wrapper must be sized with the viewport");

console.log("Product flow contract passed: Modbus TCP, scaling, states, HMI and InfluxDB topology");
