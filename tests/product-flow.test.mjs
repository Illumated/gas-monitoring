import assert from "node:assert/strict";
import crypto from "node:crypto";
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
assert.equal(client.serialBaudrate, "115200");
assert.equal(client.serialDatabits, "8");
assert.equal(client.serialStopbits, "2");
assert.equal(client.serialParity, "none");
assert.equal(client.commandDelay, "${MODBUS_COMMAND_DELAY_MS}");

const expectedRegisters = new Map([
    ["oxygen", [5376, 2]],
    ["air", [9472, 2]],
    ["vacuum", [13568, 2]],
    ["n2o", [17664, 2]],
    ["co2", [21760, 2]],
    ["valvefeedback", [25860, 1]]
]);
assert.equal(nodes.filter((node) => node.type === "modbus-read").length, 0);
const pollCycle = byId.get("poll-cycle");
const pollBuilder = byId.get("poll-builder");
const pollDelay = byId.get("poll-delay");
const pollGetter = byId.get("poll-getter");
assert.equal(pollCycle.type, "inject");
assert.equal(pollCycle.repeat, "0.5");
assert.equal(pollBuilder.type, "function");
assert.equal(pollDelay.type, "delay");
assert.equal(pollDelay.nbRateUnits, "0.3");
assert.equal(pollGetter.type, "modbus-flex-getter");
assert.equal(pollGetter.server, client.id);
for (const [name, [address, quantity]] of expectedRegisters) {
    assert.match(pollBuilder.func, new RegExp(`\\["${name}",${address},${quantity}\\]`));
}
assert.match(pollBuilder.func, /settings\.valves\?\.wbMai6UnitId/);

const normalize = byId.get("fn-normalize");
const currentDebug = byId.get("debug-wb-mai6-current");
assert.equal(normalize.outputs, 3);
assert.equal(currentDebug.type, "debug");
assert.equal(currentDebug.active, true);
assert.equal(currentDebug.tosidebar, true);
assert.deepEqual(normalize.wires[2], [currentDebug.id]);
assert.match(byId.get("ui-engineering").format, /Токовые входы WB-MAI6/);
assert.match(byId.get("ui-engineering").format, /Подготовить WB-MAI6/);
assert.match(byId.get("ui-engineering").format, /Подготовить WB-MR3LV\/I/);
assert.doesNotMatch(
    byId.get("ui-engineering").format.slice(0, byId.get("ui-engineering").format.indexOf("</template>")),
    /<style>/,
    "engineering component styles must stay outside the Vue template"
);
assert.equal(byId.get("fn-engineering-manager").outputs, 4);
assert.match(byId.get("fn-engineering-manager").func, /engineering-prepare-hardware/);
assert.equal(byId.get("exec-hardware-commission").command, "node /usr/src/node-red/tools/service-commission.mjs");
assert.match(byId.get("poll-builder").func, /hardwareCommissioning/);
assert.match(byId.get("ui-engineering").format, /IN1P/);
assert.match(byId.get("ui-engineering").format, /Период полного цикла опроса, мс/);
assert.match(byId.get("ui-engineering").format, /Рекомендуется 1000–3000 мс/);
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
flowStore.runtimeSettings = {
    gases: [
        { key: "oxygen", enabled: true },
        { key: "air", enabled: false },
        { key: "vacuum", enabled: true },
        { key: "n2o", enabled: false },
        { key: "co2", enabled: true }
    ],
    valves: { wbMai6UnitId: 77 }
};
const pollBuilderFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", pollBuilder.func);
const dynamicRequests = pollBuilderFn({}, nodeMock, contextMock, { get() { return ""; } });
assert.deepEqual(dynamicRequests[0].map((msg) => msg.topic), ["oxygen", "vacuum", "co2", "valvefeedback"]);
assert.ok(dynamicRequests[0].every((msg) => msg.payload.unitid === 77));
delete flowStore.runtimeSettings;
const envMock = {
    get(name) {
        return {
            MODBUS_POLL_INTERVAL_MS: "1000",
            GAS_STALE_TIMEOUT_MS: "4000"
        }[name] ?? "";
    }
};
const timerMock = () => ({ testTimer: true });

const wordsForCurrent = (milliamps) => {
    const value = Math.round(milliamps * 1_000_000) >>> 0;
    return [value >>> 16, value & 0xffff];
};
for (const gas of ["oxygen", "air", "vacuum", "n2o", "co2"]) {
    for (const [milliamps, value, status] of [
        [3.5, 0, "alarm"],
        [3.94, 0, "alarm"],
        [4, 0, "alarm"],
        [9.6, 3.5, "warn"],
        [10.4, 4, "ok"],
        [13.6, 6, "ok"],
        [14.4, 6.5, "warn"],
        [14.56, 6.6, "alarm"]
    ]) {
        delete normalizeStore.classificationStatus;
        const result = normalizeFn(
            { topic: gas, payload: { data: wordsForCurrent(milliamps) } },
            nodeMock,
            contextMock,
            envMock,
            timerMock,
            () => {}
        );
        assert.equal(result[0].payload.value, value);
        assert.equal(result[0].payload.status, status, `${gas} current=${milliamps}`);
        assert.equal(result[1].payload.value, value);
        assert.equal(result[2].payload.currentMa, milliamps);
        assert.equal(result[2].payload.pressureBar, value);
    }
}

for (const data of [wordsForCurrent(3.49), [0x7fff, 0xffff], [0x8000, 0], [Number.NaN, 0]]) {
    delete normalizeStore.classificationStatus;
    const result = normalizeFn(
        { topic: "air", payload: { data } },
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
    { topic: "oxygen", payload: { data: wordsForCurrent(9.6) } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "alarm", "alarm must not clear at the warning boundary");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: wordsForCurrent(9.92) } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "warn", "alarm must clear inside the warning band");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: wordsForCurrent(10.4) } },
    nodeMock,
    contextMock,
    envMock,
    timerMock,
    () => {}
);
assert.equal(hysteresisResult[0].payload.status, "warn", "warning must not clear at the normal boundary");
hysteresisResult = normalizeFn(
    { topic: "oxygen", payload: { data: wordsForCurrent(10.72) } },
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
    air: { key: "air", code: "AIR", name: "Сжатый воздух", value: null, status: "nodata", updatedAt: null },
    vacuum: { key: "vacuum", code: "VAC", name: "Вакуум", value: null, status: "nodata", updatedAt: null },
    n2o: { key: "n2o", code: "N₂O", name: "Закись азота", value: null, status: "nodata", updatedAt: null },
    co2: { key: "co2", code: "CO₂", name: "Углекислый газ", value: null, status: "nodata", updatedAt: null }
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

for (const key of ["oxygen", "air", "vacuum", "n2o", "co2"]) {
    stateStore.gasState[key] = { key, name: key, value: 5, status: "ok", updatedAt: Date.now() };
}
stateStore.gasState.oxygen.status = "alarm";
flowStore.runtimeSettings = {
    channelCount: 3,
    valves: { enabled: true, controlMode: "automatic", triggerGases: ["oxygen"], triggerOnNoData: false, activationDelaySeconds: 0, recoveryDelaySeconds: 0, feedbackTimeoutSeconds: 5, activeValue: 1, unitId: 66, coilAddress: 0 }
};
flowStore.valveFeedback = { value: 0, updatedAt: Date.now() };
delete stateStore.valveDesired;
delete stateStore.valveCommanded;
const valveTripResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(valveTripResult[0].payload.valves.status, "emergency");
assert.equal(valveTripResult[2].payload.unitid, 66);
assert.equal(valveTripResult[2].payload.address, 0);
assert.equal(valveTripResult[2].payload.value, 1, "alarm must hold K1 in its active state");
stateStore.gasState.oxygen.status = "ok";
const valveRecoveryResult = stateFn({}, {}, stateContext, envMock, timerMock, () => {});
assert.equal(valveRecoveryResult[2].payload.value, 0, "automatic recovery must release K1");
flowStore.runtimeSettings = {};

delete normalizeStore.classificationStatus;
const sequencerResult = normalizeFn(
    { topic: "poll-sequencer", modbusRequest: { name: "air" }, payload: wordsForCurrent(12.32) },
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
        { topic: "oxygen", payload: { data: wordsForCurrent(12) } },
        nodeMock,
        contextMock,
        envMock,
        () => { scheduledTimers += 1; },
        () => {}
    );
}
assert.equal(scheduledTimers, 0, "successful samples must not create per-reading stale timers");

assert.equal(nodes.filter((node) => node.type === "http request").length, 5);
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
    [{ kind: "gas-reminder", name: "Закись азота", value: 6.7, from: "alarm", to: "alarm", updatedAt: Date.now() }, /⚠️ НАПОМИНАНИЕ/],
    [{ kind: "valve-state-change", name: "Клапаны", value: 0, from: "normal", to: "emergency", updatedAt: Date.now() }, /🔴 КЛАПАНЫ: АВАРИЙНЫЙ РЕЖИМ[\s\S]*Обратная связь: 0 — аварийный режим/]
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
assert.match(byId.get("ui-monitor").format, /\.gm-value strong\{color:#eef6ff;font-size:clamp\(58px,7vw,112px\)/, "pressure value must use the enlarged responsive type scale");
assert.match(byId.get("ui-monitor").format, /\.gm-card\.is-alarm \.gm-value strong\{color:#ff7080\}/, "pressure value must use the channel state color");
assert.match(byId.get("ui-monitor").format, /\.gm-badge\{min-width:110px;[\s\S]*font-size:12px/, "channel status badge must remain readable in five-channel mode");
assert.match(byId.get("ui-monitor").format, /\.gm-card-head p\{margin:0;color:#64b9ea;font-size:20px/, "O2, AIR and N2O channel codes must be enlarged");
assert.match(byId.get("ui-monitor").format, /\.gm-card\.is-alarm\{border-top-color:#ff5364;animation:gm-alarm-pulse 2\.4s ease-in-out infinite\}/, "alarm card must use the soft pulse animation");
assert.match(byId.get("ui-monitor").format, /@media\(prefers-reduced-motion:reduce\)\{\.gm-card\.is-alarm\{animation:none;/, "alarm emphasis must respect reduced-motion accessibility");
assert.match(byId.get("ui-engineering").format, /\{\{gas\.name\}\} — \{\{gas\.input\}\}/, "valve triggers must show gas names with WB-MAI6 input numbers");

const engineeringNode = byId.get("fn-engineering-manager");
const engineeringFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", engineeringNode.func);
globalThis.global.get = (name) => name === "crypto" ? crypto : undefined;
const engineeringStore = {};
const engineeringContext = {
    get(key) { return engineeringStore[key]; },
    set(key, value) { engineeringStore[key] = value; }
};
const engineeringEnv = {
    get(name) {
        return {
            ADMIN_ACCESS_CODE: "admin-test-code",
            NODE_RED_CREDENTIAL_SECRET: "test-credential-secret",
            AUTH_SERVICE_TOKEN: "test-auth-service-token",
            AUTH_SERVICE_URL: "http://auth-service:8082",
            SERVICE_UNLOCK_MINUTES: "15",
            GAS_STALE_TIMEOUT_MS: "4000",
            MONITOR_ID: "RINIR-A1B2C3"
        }[name] ?? "";
    }
};
delete flowStore.runtimeSettings;
const defaultSettingsResult = engineeringFn(
    { _client: { socketId: "client-defaults" }, payload: { action: "engineering-load" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.deepEqual(
    defaultSettingsResult[0].payload.settings.valves.triggerGases,
    ["oxygen", "air", "vacuum", "n2o", "co2"],
    "all five gas channels must be available as default valve triggers"
);
assert.equal(defaultSettingsResult[0].payload.settings.pollIntervalMs, 1000);
const emptyRegistryResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-unlock", code: "operator-test-code" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(emptyRegistryResult[0].payload.unlocked, false);
assert.match(emptyRegistryResult[0].payload.message, /зарегистрировать исполнителя/);
const adminUnlockResult = engineeringFn(
    { _client: { socketId: "client-admin" }, payload: { action: "engineering-admin-unlock", code: "admin-test-code" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(adminUnlockResult[0].payload.admin, true);
assert.equal(adminUnlockResult[0].payload.session.name, "Администратор");
assert.deepEqual(adminUnlockResult[0]._client, { socketId: "client-admin" }, "engineering responses must stay scoped to the requesting dashboard client");
const addOperatorResult = engineeringFn(
    { _client: { socketId: "client-admin" }, payload: { action: "engineering-operator-add", name: "Гимранов", code: "23WEsdxc" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(addOperatorResult[0].payload.success, true);
assert.equal(addOperatorResult[0].payload.operators[0].name, "Гимранов");
assert.equal(flowStore.serviceOperators[0].name, "Гимранов");
assert.notEqual(flowStore.serviceOperators[0].codeHash, "23WEsdxc", "operator code must not be stored in plaintext");
const unlockResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-unlock", code: "23WEsdxc" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(unlockResult[0].payload.unlocked, true);
assert.equal(unlockResult[0].payload.session.name, "Гимранов");
const candidateSettings = {
    siteName: "Городская больница",
    locationName: "Реанимация, 2 этаж",
    gases: [
        { key: "oxygen", code: "O₂", input: "IN1P", enabled: true, name: "Кислород", warnLow: 3.5, okLow: 4.1, okHigh: 6, warnHigh: 6.5 },
        { key: "air", code: "AIR", input: "IN2P", enabled: true, name: "Сжатый воздух", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 },
        { key: "vacuum", code: "VAC", input: "IN3P", enabled: true, name: "Вакуум", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 },
        { key: "n2o", code: "N₂O", input: "IN4P", enabled: true, name: "Закись азота", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 },
        { key: "co2", code: "CO₂", input: "IN5P", enabled: true, name: "Углекислый газ", warnLow: 3.5, okLow: 4, okHigh: 6, warnHigh: 6.5 }
    ],
    channelCount: 5,
    displayMax: 10,
    hysteresis: 0.1,
    pollIntervalMs: 2500,
    valves: { enabled: false, controlMode: "monitor", triggerGases: [], triggerOnNoData: false, activationDelaySeconds: 0, recoveryDelaySeconds: 5, feedbackTimeoutSeconds: 5 }
};
const saveResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", operator: "Подменённое имя", settings: candidateSettings } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(saveResult[0].payload.success, true);
assert.equal(saveResult[0].payload.identity.monitorId, "RINIR-A1B2C3");
assert.equal(saveResult[0].payload.identity.siteName, "Городская больница");
assert.equal(saveResult[0].payload.identity.locationName, "Реанимация, 2 этаж");
assert.equal(flowStore.runtimeSettings.siteName, "Городская больница");
assert.equal(flowStore.runtimeSettings.locationName, "Реанимация, 2 этаж");
assert.equal(flowStore.runtimeSettings.gases[0].okLow, 4.1);
assert.equal(flowStore.runtimeSettings.pollIntervalMs, 2500);
assert.equal(flowStore.runtimeSettings.operator, "Гимранов", "operator must come from the authenticated code session");
assert.equal(saveResult[0].payload.saved, true);
assert.equal(saveResult[1].payload.kind, "settings-change");
assert.equal(saveResult[1].payload.operator, "Гимранов");
const recreatedEngineeringFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", engineeringNode.func);
const afterRestartLoad = recreatedEngineeringFn(
    { _client: { socketId: "client-2" }, payload: { action: "engineering-load" } },
    nodeMock, { get() {}, set() {} }, engineeringEnv
);
assert.equal(afterRestartLoad[0].payload.settings.gases[0].okLow, 4.1, "runtime settings must be loaded from persistent flow context after function recreation");
assert.equal(afterRestartLoad[0].payload.settings.gases.length, 5, "older settings must be migrated to the five-channel schema");
assert.equal(afterRestartLoad[0].payload.settings.channelCount, 5);
assert.equal(afterRestartLoad[0].payload.settings.pollIntervalMs, 2500);
const invalidPollInterval = structuredClone(candidateSettings);
invalidPollInterval.pollIntervalMs = 500;
const invalidPollResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", settings: invalidPollInterval } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(invalidPollResult[0].payload.success, false);
assert.equal(flowStore.runtimeSettings.pollIntervalMs, 2500, "invalid poll interval must not partially persist");
const rejectedSettings = structuredClone(candidateSettings);
rejectedSettings.gases[0].warnHigh = 10;
const rejectedResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", settings: rejectedSettings } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(rejectedResult[0].payload.success, false);
assert.equal(flowStore.runtimeSettings.gases[0].warnHigh, 6.5, "invalid settings must not partially persist");
const missingLocation = structuredClone(candidateSettings);
missingLocation.locationName = "";
const missingLocationResult = engineeringFn(
    { _client: { socketId: "client-1" }, payload: { action: "engineering-save", settings: missingLocation } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(missingLocationResult[0].payload.success, false);
assert.equal(flowStore.runtimeSettings.locationName, "Реанимация, 2 этаж", "empty location must not partially persist");
const usersRequest = engineeringFn(
    { _client: { socketId: "client-admin" }, payload: { action: "engineering-user-add", username: "doctor", password: "strong-password" } },
    nodeMock, engineeringContext, engineeringEnv
);
assert.equal(usersRequest[2].method, "POST");
assert.equal(usersRequest[2].url, "http://auth-service:8082/users");
assert.equal(usersRequest[2].headers["X-Auth-Admin-Token"], "test-auth-service-token");
assert.deepEqual(usersRequest[2].payload, { username: "doctor", password: "strong-password" });
const authUsersResponseNode = byId.get("fn-auth-users-response");
const authUsersResponseFn = new Function("msg", "node", "context", "env", "setTimeout", "clearTimeout", authUsersResponseNode.func);
const authUsersUiResult = authUsersResponseFn(
    { _client: { socketId: "client-admin" }, statusCode: 201, authUiAction: "engineering-user-add", authTarget: "doctor", payload: { users: [{ username: "doctor" }] } },
    nodeMock, contextMock, engineeringEnv
);
assert.deepEqual(authUsersUiResult[0]._client, { socketId: "client-admin" });
assert.equal(authUsersUiResult[1].payload.operator, "Администратор");
assert.match(byId.get("ui-engineering").format, /!this\.dirty\|\|p\.saved/, "background refresh must not overwrite a dirty settings form");
assert.doesNotMatch(byId.get("ui-engineering").format, /v-model="operator"/, "operator identity must not be editable");
assert.doesNotMatch(byId.get("ui-engineering").format, /Исполнитель определяется по персональному коду/, "service UI must not expose implementation guidance");
assert.doesNotMatch(byId.get("ui-engineering").format, /Черновик формы не перезаписывается/, "service UI must not expose internal refresh behavior");
assert.match(byId.get("ui-engineering").format, /\.admin-identity\{[^}]*gap:12px/, "admin identity and creation date must have a visible gap");

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
