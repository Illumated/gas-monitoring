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
assert.equal(client.commandDelay, "${MODBUS_COMMAND_DELAY_MS}");

const expectedRegisters = new Map([
    ["oxygen", 5380],
    ["air", 9476],
    ["n2o", 13572]
]);
assert.equal(nodes.filter((node) => node.type === "modbus-read").length, 0);
const pollCycle = byId.get("poll-cycle");
const sequencer = byId.get("poll-sequencer");
assert.equal(pollCycle.type, "inject");
assert.equal(pollCycle.repeat, "1");
assert.equal(sequencer.type, "modbus-flex-sequencer");
assert.equal(sequencer.server, client.id);
assert.deepEqual(sequencer.sequences.map((item) => item.name), [...expectedRegisters.keys()]);
for (const sequence of sequencer.sequences) {
    assert.equal(sequence.fc, "FC4");
    assert.equal(sequence.unitid, "65");
    assert.equal(Number(sequence.address), expectedRegisters.get(sequence.name));
    assert.equal(sequence.quantity, "1");
}

const normalize = byId.get("fn-normalize");
const normalizeFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", normalize.func);
const nodeMock = { staleTimers: new Map(), lastStatus: new Map(), send() {}, error() {} };
const contextMock = { get() {}, set() {} };
const envMock = {
    get(name) {
        return {
            MODBUS_POLL_INTERVAL_MS: "1000",
            GAS_STALE_TIMEOUT_MS: "4000"
        }[name] ?? "";
    }
};
const timerMock = () => ({ testTimer: true });

for (const [raw, value, status] of [
    [0, 0, "alarm"],
    [35, 3.5, "warn"],
    [40, 4, "ok"],
    [60, 6, "ok"],
    [65, 6.5, "warn"],
    [66, 6.6, "alarm"]
]) {
    nodeMock.lastStatus.clear();
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
    nodeMock.lastStatus.clear();
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

nodeMock.lastStatus.set("oxygen", "alarm");
let hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: [35] } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "alarm", "alarm must not clear at the warning boundary");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: [37] } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "warn", "alarm must clear inside the warning band");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: [40] } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "warn", "warning must not clear at the normal boundary");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: [42] } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "ok", "warning must clear inside the normal band");

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

nodeMock.lastStatus.clear();
const sequencerResult = normalizeFn(
    { topic: "poll-sequencer", modbusRequest: { name: "air" }, payload: [52] },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(sequencerResult[0].payload.key, "air");
assert.equal(sequencerResult[0].payload.value, 5.2);

assert.equal(nodes.filter((node) => node.type === "http request").length, 3);
assert.ok(byId.has("fn-max-request"), "MAX notification request builder must exist");
assert.ok(byId.has("http-max-send"), "MAX HTTP sender must exist");
assert.equal(byId.has("fn-simulator"), false, "product flow must not bypass Modbus with an internal simulator");
const maxNode = byId.get("fn-max-request");
const maxFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", maxNode.func);
const maxEvent = { payload: { kind: "gas-state-change", name: "Кислород", value: 3.5, from: "ok", to: "warn" } };
assert.equal(maxFn(maxEvent, { error() {} }, contextMock, envMock), null, "MAX must be disabled by default");
const maxEnv = {
    get(name) {
        return {
            MAX_NOTIFICATIONS_ENABLED: "true",
            MAX_BOT_TOKEN: "test-token",
            MAX_CHAT_ID: "123",
            MAX_API_URL: "https://platform-api2.max.ru"
        }[name] ?? "";
    }
};
const maxResult = maxFn(structuredClone(maxEvent), { error() {} }, contextMock, maxEnv);
assert.equal(maxResult.url, "https://platform-api2.max.ru/messages?chat_id=123");
assert.equal(maxResult.headers.Authorization, "test-token");
assert.match(maxResult.payload.text, /НОРМА → ВНИМАНИЕ/);
assert.equal(byId.get("cfg-ui-base").path, "/dashboard");
assert.equal(byId.get("cfg-page-monitor").path, "/monitoring");
assert.equal(byId.get("cfg-page-history").path, "/history");
assert.match(byId.get("ui-monitor").format, /box-sizing:border-box/, "desktop HMI must include padding in its viewport height");
assert.match(byId.get("ui-monitor").format, /grid-template-rows:auto minmax\(0,1fr\) auto/, "desktop HMI must distribute free height between header, cards and footer");
assert.match(byId.get("ui-monitor").format, /\.nrdb-ui-group\.gm-group \.gm-widget/, "FlowFuse widget wrapper must be sized with the viewport");

console.log("Product flow contract passed: Modbus TCP, scaling, states, HMI and InfluxDB topology");
