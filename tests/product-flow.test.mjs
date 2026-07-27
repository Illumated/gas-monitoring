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
const nodeMock = { send() {}, error() {} };
const normalizeStore = {};
const contextMock = {
    get(key) { return normalizeStore[key]; },
    set(key, value) { normalizeStore[key] = value; }
};
const flowStore = {};
globalThis.flow = {
    get(key) { return flowStore[key]; },
    set(key, value) { flowStore[key] = value; }
};
const envMock = {
    get(name) {
        return {
            MODBUS_POLL_INTERVAL_MS: "1000",
            GAS_STALE_TIMEOUT_MS: "4000"
        }[name] ?? "";
    }
};
const timerMock = () => ({ testTimer: true });

for (const gas of ["oxygen", "air", "n2o"]) {
    for (const [raw, value, status] of [
        [0, 0, "alarm"],
        [35, 3.5, "warn"],
        [40, 4, "ok"],
        [60, 6, "ok"],
        [65, 6.5, "warn"],
        [66, 6.6, "alarm"]
    ]) {
        delete normalizeStore.classificationStatus;
        const result = normalizeFn(
            { topic: gas, payload: { data: [raw] } },
            nodeMock,
            contextMock,
            envMock,
            timerMock,
            () => {}
        );
        assert.equal(result[0].payload.value, value);
        assert.equal(result[0].payload.status, status, `${gas} raw=${raw}`);
        assert.equal(result[1].payload.value, value);
    }
}

for (const raw of [32767, -32768, Number.NaN]) {
    delete normalizeStore.classificationStatus;
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

const emptyFailureResult = normalizeFn(
    { topic: "oxygen", payload: [] },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.deepEqual(emptyFailureResult, [null, null], "one empty Modbus response must wait for centralized stale timeout");

normalizeStore.classificationStatus = { oxygen: "alarm" };
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
const stateStore = {
    gasState: persistedState,
    reportedStatus: { oxygen: "ok" },
    bootAt: Date.now() - 10000
};
const stateContext = {
    get(key) { return stateStore[key]; },
    set(key, value) { stateStore[key] = value; }
};
const staleResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(staleResult[0].payload.gases[0].value, null, "old persisted value must not remain visible");
assert.equal(staleResult[0].payload.gases[0].status, "nodata", "old persisted value must become nodata");
assert.equal(staleResult[1].length, 1, "stale transition must be emitted once");
assert.equal(staleResult[1][0].payload.from, "ok");
assert.equal(staleResult[1][0].payload.to, "nodata");
const repeatedStaleResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(repeatedStaleResult[1].length, 0, "stable stale state must not repeat notifications");

stateStore.gasState.oxygen = {
    key: "oxygen",
    code: "O₂",
    name: "Кислород",
    value: 5,
    status: "ok",
    updatedAt: Date.now() - 3000
};
stateStore.reportedStatus.oxygen = "ok";
const freshResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(freshResult[0].payload.gases[0].status, "ok", "value younger than stale timeout must remain visible");

delete normalizeStore.classificationStatus;
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

let scheduledTimers = 0;
for (let index = 0; index < 10; index += 1) {
    normalizeFn(
        { topic: "oxygen", payload: { data: [50] } },
        nodeMock,
        contextMock,
        envMock,
        () => { scheduledTimers += 1; },
        () => {}
    );
}
assert.equal(scheduledTimers, 0, "successful samples must not create per-reading stale timers");

assert.equal(nodes.filter((node) => node.type === "http request").length, 4);
assert.ok(byId.has("fn-max-request"), "MAX notification request builder must exist");
assert.ok(byId.has("http-max-send"), "MAX HTTP sender must exist");
assert.equal(byId.has("fn-simulator"), false, "product flow must not bypass Modbus with an internal simulator");
const maxNode = byId.get("fn-max-request");
const maxFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", maxNode.func);
const maxEvent = { payload: { kind: "gas-state-change", name: "Кислород", value: 3.5, from: "ok", to: "warn" } };
assert.equal(maxFn(maxEvent, { error() {} }, contextMock, envMock), null, "MAX must be disabled by default");
flowStore.runtimeSettings = {
    siteName: "Городская больница",
    locationName: "Реанимация, 2 этаж"
};
const maxEnv = {
    get(name) {
        return {
            MAX_NOTIFICATIONS_ENABLED: "true",
            MAX_BOT_TOKEN: "test-token",
            MAX_CHAT_ID: "123",
            MAX_API_URL: "https://platform-api2.max.ru",
            MONITOR_ID: "RINIR-A1B2C3",
            GAS_STALE_TIMEOUT_MS: "4000",
            TZ: "Europe/Moscow"
        }[name] ?? "";
    }
};
const maxResult = maxFn(structuredClone(maxEvent), { error() {} }, contextMock, maxEnv);
assert.equal(maxResult.url, "https://platform-api2.max.ru/messages?chat_id=123");
assert.equal(maxResult.headers.Authorization, "test-token");
assert.match(maxResult.payload.text, /НОРМА → ВНИМАНИЕ/);
assert.match(maxResult.payload.text, /🟡 ВНИМАНИЕ — Кислород/);
assert.match(maxResult.payload.text, /Объект: Городская больница/);
assert.match(maxResult.payload.text, /Расположение: Реанимация, 2 этаж/);
assert.match(maxResult.payload.text, /Установка: RINIR-A1B2C3/);

for (const [event, expected] of [
    [{ kind: "gas-state-change", name: "Кислород", value: 2.8, from: "warn", to: "alarm", updatedAt: Date.now() }, /🔴 АВАРИЯ/],
    [{ kind: "gas-state-change", name: "Медицинский воздух", value: null, lastValue: 5.1, from: "ok", to: "nodata", reason: "stale", updatedAt: Date.now() }, /Последнее значение: 5,1 бар[\s\S]*нет достоверных данных более 4 секунд/],
    [{ kind: "gas-state-change", name: "Медицинский воздух", value: 5.2, from: "nodata", to: "ok", durationMs: 78000, updatedAt: Date.now() }, /✅ ВОССТАНОВЛЕНО[\s\S]*1 мин 18 сек/],
    [{ kind: "gas-reminder", name: "Закись азота", value: 6.7, from: "alarm", to: "alarm", updatedAt: Date.now() }, /⚠️ НАПОМИНАНИЕ/]
]) {
    const result = maxFn({ payload: event }, { error() {} }, contextMock, maxEnv);
    assert.match(result.payload.text, expected);
    assert.match(result.payload.text, /Время:/);
}

const reminderNode = byId.get("fn-max-reminder");
const reminderFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", reminderNode.func);
const reminderStore = {};
const reminderContext = {
    get(key) { return reminderStore[key]; },
    set(key, value) { reminderStore[key] = value; }
};
flowStore.gasState = {
    oxygen: { key: "oxygen", name: "Кислород", value: 2.8, status: "alarm", updatedAt: Date.now() }
};
const firstReminder = reminderFn({}, nodeMock, reminderContext, {
    get(name) {
        return { MAX_NOTIFICATIONS_ENABLED: "true", MAX_REMINDER_INTERVAL_MINUTES: "1" }[name] ?? "";
    }
});
assert.equal(firstReminder.length, 1);
assert.equal(firstReminder[0].payload.kind, "gas-reminder");
assert.equal(reminderFn({}, nodeMock, reminderContext, {
    get(name) {
        return { MAX_NOTIFICATIONS_ENABLED: "true", MAX_REMINDER_INTERVAL_MINUTES: "1" }[name] ?? "";
    }
}).length, 0, "reminder must not repeat before the configured interval");
assert.equal(byId.get("cfg-ui-base").path, "/dashboard");
assert.equal(byId.get("cfg-page-monitor").path, "/monitoring");
assert.equal(byId.get("cfg-page-history").path, "/history");
assert.equal(byId.get("cfg-page-events").path, "/events");
assert.equal(byId.get("cfg-page-engineering").path, "/engineering");
assert.ok(byId.has("fn-event-write"), "event journal writer must exist");
assert.ok(byId.has("fn-engineering-manager"), "engineering settings manager must exist");
assert.match(byId.get("ui-engineering").format, /ID установки из Debian hostname/);
assert.match(byId.get("ui-engineering").format, /Название больницы/);
assert.match(byId.get("ui-engineering").format, /Расположение/);
assert.match(byId.get("ui-history").format, /limits\.displayMax/, "history scale must use runtime display maximum");
assert.match(byId.get("ui-history").format, /segments/, "history must render data gaps as separate segments");
assert.match(byId.get("ui-monitor").format, /box-sizing:border-box/, "desktop HMI must include padding in its viewport height");
assert.match(byId.get("ui-monitor").format, /grid-template-rows:auto minmax\(0,1fr\) auto/, "desktop HMI must distribute free height between header, cards and footer");
assert.match(byId.get("ui-monitor").format, /\.nrdb-ui-group\.gm-group \.gm-widget/, "FlowFuse widget wrapper must be sized with the viewport");
assert.match(byId.get("ui-monitor").format, /<h1>Контроль давления<\/h1>/, "HMI must use the approved short title");
assert.match(byId.get("ui-monitor").format, /class="gm-clock"/, "clock must use a dedicated status-style panel");
assert.match(byId.get("ui-monitor").format, />\.v-card>\.v-card-text\{height:100%!important;padding:0!important\}/, "FlowFuse group padding must not create an outer frame");
assert.match(byId.get("ui-monitor").format, /html:has\(\.gm-page\),body:has\(\.gm-page\)\{overflow:hidden!important\}/, "desktop monitoring must not show an empty document scrollbar");
assert.match(byId.get("ui-monitor").format, /\.gm-value strong\{color:#eef6ff;font-size:clamp\(72px,8vw,124px\)/, "pressure value must use the enlarged responsive type scale");
assert.match(byId.get("ui-monitor").format, /\.gm-card\.is-alarm \.gm-value strong\{color:#ff7080\}/, "pressure value must use the channel state color");
assert.match(byId.get("ui-monitor").format, /\.gm-badge\{min-width:112px;[\s\S]*font-size:13px/, "channel status badge must be enlarged");
assert.match(byId.get("ui-monitor").format, /\.gm-card-head p\{margin:0;color:#64b9ea;font-size:20px/, "O2, AIR and N2O channel codes must be enlarged");

const engineeringNode = byId.get("fn-engineering-manager");
const engineeringFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", engineeringNode.func);
const engineeringStore = {};
const engineeringContext = {
    get(key) { return engineeringStore[key]; },
    set(key, value) { engineeringStore[key] = value; }
};
const engineeringEnv = {
    get(name) {
        return {
            SERVICE_ACCESS_CODE: "test-code",
            SERVICE_UNLOCK_MINUTES: "15",
            GAS_STALE_TIMEOUT_MS: "4000",
            MONITOR_ID: "RINIR-A1B2C3"
        }[name] ?? "";
    }
};
const unlockResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-unlock", code: "test-code" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(unlockResult[0].payload.unlocked, true);
const candidateSettings = {
    siteName: "Городская больница",
    locationName: "Реанимация, 2 этаж",
    gases: [
        { key: "oxygen", name: "Кислород", warnLow: 3.5, okLow: 4.1, okHigh: 6, warnHigh: 6.5 },
        { key: "air", name: "Медицинский воздух", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 },
        { key: "n2o", name: "Закись азота", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 }
    ],
    displayMax: 8,
    hysteresis: 0.1
};
const saveResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", operator: "TEST", settings: candidateSettings } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(saveResult[0].payload.success, true);
assert.equal(saveResult[0].payload.identity.monitorId, "RINIR-A1B2C3");
assert.equal(saveResult[0].payload.identity.siteName, "Городская больница");
assert.equal(saveResult[0].payload.identity.locationName, "Реанимация, 2 этаж");
assert.equal(flowStore.runtimeSettings.siteName, "Городская больница");
assert.equal(flowStore.runtimeSettings.locationName, "Реанимация, 2 этаж");
assert.equal(flowStore.runtimeSettings.gases[0].okLow, 4.1);
assert.equal(saveResult[1].payload.kind, "settings-change");
const recreatedEngineeringFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", engineeringNode.func);
const afterRestartLoad = recreatedEngineeringFn(
    { _client: { socketId: "client-2" }, payload: { action: "engineering-load" } },
    nodeMock, { get() {}, set() {} }, engineeringEnv
);
assert.equal(afterRestartLoad[0].payload.settings.gases[0].okLow, 4.1, "runtime settings must be loaded from persistent flow context after function recreation");
const rejectedSettings = structuredClone(candidateSettings);
rejectedSettings.gases[0].warnHigh = 9;
const rejectedResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", operator: "TEST", settings: rejectedSettings } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(rejectedResult[0].payload.success, false);
assert.equal(flowStore.runtimeSettings.gases[0].warnHigh, 6.5, "invalid settings must not partially persist");
const missingLocation = structuredClone(candidateSettings);
missingLocation.locationName = "";
const missingLocationResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", operator: "TEST", settings: missingLocation } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(missingLocationResult[0].payload.success, false);
assert.equal(flowStore.runtimeSettings.locationName, "Реанимация, 2 этаж", "empty location must not partially persist");

const eventNode = byId.get("fn-event-write");
const eventFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", eventNode.func);
const eventResult = eventFn(
    { payload: { kind: "gas-state-change", key: "oxygen", name: "Кислород", from: "ok", to: "alarm", value: 2, updatedAt: 123 } },
    nodeMock, contextMock, maxEnv
);
assert.match(eventResult.payload, /^gas_event,/);
assert.match(eventResult.payload, /from=ok,to=alarm/);
assert.match(eventResult.payload, /monitor_id=/);

const maxTrackNode = byId.get("fn-max-track");
const maxTrackFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", maxTrackNode.func);
const retryResult = maxTrackFn(
    { statusCode: 500, maxAttempt: 1, maxRequestBody: { text: "retry" } },
    nodeMock, contextMock, { get(name) { return name === "MAX_RETRY_COUNT" ? "2" : ""; } }
);
assert.equal(retryResult.maxAttempt, 2);
assert.deepEqual(retryResult.payload, { text: "retry" });
let maxErrors = 0;
const exhaustedResult = maxTrackFn(
    { statusCode: 500, maxAttempt: 3, maxRequestBody: { text: "failed" } },
    { error() { maxErrors += 1; } },
    contextMock,
    { get(name) { return name === "MAX_RETRY_COUNT" ? "2" : ""; } }
);
assert.equal(exhaustedResult, null);
assert.equal(maxErrors, 1);
assert.equal(flowStore.systemHealth.max.status, "error");

console.log("Product flow contract passed: Modbus TCP, scaling, states, HMI and InfluxDB topology");
