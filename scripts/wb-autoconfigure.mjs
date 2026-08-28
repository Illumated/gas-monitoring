import ModbusRTU from "@openp4nr/modbus-serial";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { registersForInput } from "./lib/wb-mai6-map.mjs";

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const integer = (name, fallback, min, max) => {
    const value = Number(valueOf(name, fallback));
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be in ${min}..${max}`);
    return value;
};

const host = valueOf("--host", "192.168.50.10");
const port = integer("--port", 502, 1, 65535);
const firstUnit = integer("--first-unit", 1, 1, 247);
const lastUnit = integer("--last-unit", 247, firstUnit, 247);
const timeoutMs = integer("--timeout-ms", 250, 50, 3000);
const envFile = resolve(valueOf("--env-file", "/config/gas-monitoring.env"));
const evidenceDirectory = resolve(valueOf("--evidence", "/evidence"));
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify-only");
const deviceMode = valueOf("--device", "all");
const skipEnvUpdate = args.includes("--skip-env-update");
if (!["all", "mai6", "relay"].includes(deviceMode)) throw new Error("--device must be all, mai6 or relay");
const mai6TargetUnit = integer("--mai6-unit", 65, 1, 247);
const relayTargetUnit = integer("--relay-unit", 66, 1, 247);
if (mai6TargetUnit === relayTargetUnit) throw new Error("target Unit IDs must differ");
if (!apply && !verifyOnly) throw new Error("automatic commissioning requires --apply or --verify-only");

const decodeString = (registers) => registers
    .flatMap((value) => [(value >> 8) & 0xff, value & 0xff])
    .filter(Boolean)
    .map((value) => String.fromCharCode(value))
    .join("")
    .trim();
const client = new ModbusRTU();
client.setTimeout(timeoutMs);
const MODBUS_REQUEST_DELAY_MS = 300;
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
let previousRequestFinishedAt = 0;
const request = async (operation) => {
    const remainingDelay = MODBUS_REQUEST_DELAY_MS - (Date.now() - previousRequestFinishedAt);
    if (previousRequestFinishedAt && remainingDelay > 0) await delay(remainingDelay);
    try {
        return await operation();
    } finally {
        previousRequestFinishedAt = Date.now();
    }
};
const found = [];
const evidence = { createdUtc: new Date().toISOString(), target: { host, port }, scan: { firstUnit, lastUnit, timeoutMs }, found };

const scan = async () => {
    await client.connectTCP(host, { port });
    for (let unitId = firstUnit; unitId <= lastUnit; unitId += 1) {
        client.setID(unitId);
        try {
            const response = await request(() => client.readInputRegisters(200, 20));
            const model = decodeString(response.data);
            if (model) found.push({ unitId, model });
        } catch {}
    }
};

const configureMai6 = async (unitId) => {
    client.setTimeout(3000);
    client.setID(unitId);
    for (const input of ["IN1P", "IN2P", "IN3P", "IN4P", "IN5P", "IN6P"]) {
        const registers = registersForInput(input);
        const dryContact = input === "IN6P";
        await request(() => client.writeRegister(registers.type, dryContact ? 5632 : 4866));
        if (!dryContact) {
            await request(() => client.writeRegister(registers.scaleLow, 0));
            await request(() => client.writeRegister(registers.scaleHigh, 100));
        }
        const type = (await request(() => client.readHoldingRegisters(registers.type, 1))).data[0];
        const low = dryContact ? null : (await request(() => client.readHoldingRegisters(registers.scaleLow, 1))).data[0];
        const high = dryContact ? null : (await request(() => client.readHoldingRegisters(registers.scaleHigh, 1))).data[0];
        if (type !== (dryContact ? 5632 : 4866) || (!dryContact && (low !== 0 || high !== 100))) {
            throw new Error(`WB-MAI6 readback failed for ${input}`);
        }
    }
};

const configureConnection = async (unitId, targetUnitId) => {
    client.setID(unitId);
    await request(() => client.writeRegister(111, 0));
    await request(() => client.writeRegister(112, 2));
    if (unitId !== targetUnitId) {
        await request(() => client.writeRegister(128, targetUnitId));
        client.setID(targetUnitId);
    }
    // Скорость меняется последней: после записи устройство перестаёт отвечать шлюзу на 9600 bit/s.
    await request(() => client.writeRegister(110, 1152));
    return targetUnitId;
};

const verifyConnection = async (unitId) => {
    client.setID(unitId);
    const values = (await request(() => client.readHoldingRegisters(110, 3))).data;
    const address = (await request(() => client.readHoldingRegisters(128, 1))).data[0];
    if (values[0] !== 1152 || values[1] !== 0 || values[2] !== 2 || address !== unitId) {
        throw new Error(`connection profile readback failed for Unit ID ${unitId}`);
    }
};

const updateEnv = async (mai6UnitId, relayUnitId) => {
    let text = await readFile(envFile, "utf8");
    const set = (name, value) => {
        const line = `${name}=${value}`;
        text = new RegExp(`^${name}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${name}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
    };
    set("MODBUS_UNIT_ID", mai6UnitId);
    if (relayUnitId !== null) set("VALVE_RELAY_UNIT_ID", relayUnitId);
    const temporary = `${envFile}.tmp`;
    await writeFile(temporary, text, { mode: 0o600 });
    await rename(temporary, envFile);
};

try {
    await scan();
    const mai6 = found.filter((device) => /WB-?MAI6/i.test(device.model));
    const relays = found.filter((device) => /WB-?MR3LV/i.test(device.model));
    if (deviceMode !== "relay" && mai6.length !== 1) throw new Error(`expected exactly one WB-MAI6, found ${mai6.length}`);
    if (deviceMode === "relay" && relays.length !== 1) throw new Error(`expected exactly one WB-MR3LV/I, found ${relays.length}`);
    if (deviceMode !== "relay" && relays.length > 1) throw new Error(`expected at most one WB-MR3LV/I, found ${relays.length}`);
    if (relays[0]?.unitId === mai6[0].unitId) throw new Error("WB-MAI6 and WB-MR3LV/I must have different Unit IDs");
    if (verifyOnly) {
        if (deviceMode !== "relay" && mai6[0].unitId !== mai6TargetUnit) throw new Error(`WB-MAI6 expected at Unit ID ${mai6TargetUnit}`);
        if (deviceMode !== "mai6" && relays[0] && relays[0].unitId !== relayTargetUnit) throw new Error(`WB-MR3LV/I expected at Unit ID ${relayTargetUnit}`);
        if (deviceMode !== "relay") await verifyConnection(mai6TargetUnit);
        if (deviceMode !== "mai6" && relays[0]) await verifyConnection(relayTargetUnit);
        evidence.result = { status: "verified", wbMai6UnitId: deviceMode === "relay" ? null : mai6TargetUnit, wbMr3lvUnitId: deviceMode === "mai6" ? null : relays[0]?.unitId ?? null };
    } else {
        const occupiedTargets = found.filter((device) => [mai6TargetUnit, relayTargetUnit].includes(device.unitId));
        for (const device of occupiedTargets) {
            const expected = device === mai6[0] ? mai6TargetUnit : device === relays[0] ? relayTargetUnit : null;
            if (expected !== device.unitId) throw new Error(`target Unit ID ${device.unitId} is already occupied`);
        }
        if (deviceMode !== "relay") await configureMai6(mai6[0].unitId);
        const configuredMai6Unit = deviceMode === "relay" ? null : await configureConnection(mai6[0].unitId, mai6TargetUnit);
        const configuredRelayUnit = deviceMode === "mai6" || !relays[0] ? null : await configureConnection(relays[0].unitId, relayTargetUnit);
        if (!skipEnvUpdate) await updateEnv(configuredMai6Unit, configuredRelayUnit);
        evidence.result = { status: "configured", wbMai6UnitId: configuredMai6Unit, wbMr3lvUnitId: configuredRelayUnit };
    }
    console.log(JSON.stringify(evidence.result));
} catch (error) {
    evidence.result = { status: "failed", error: error.message };
    throw error;
} finally {
    if (client.isOpen) client.close();
    await mkdir(evidenceDirectory, { recursive: true });
    const stamp = evidence.createdUtc.replaceAll(/[-:.]/g, "");
    await writeFile(resolve(evidenceDirectory, `hardware-autoconfigure-${stamp}.json`), JSON.stringify(evidence, null, 2) + "\n");
}
