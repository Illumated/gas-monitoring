import ModbusRTU from "@openp4nr/modbus-serial";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { registersForInput } from "./lib/wb-mai6-map.mjs";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const valueOf = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const integer = (name, fallback, min, max) => {
    const value = Number(valueOf(name, fallback));
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer in ${min}..${max}`);
    }
    return value;
};

if (has("--help")) {
    console.log(`Read-only WB-MAI6 hardware FAT

Usage:
  node scripts/hardware-fat.mjs --inventory [--inputs IN1P,IN2P,IN3P]
  node scripts/hardware-fat.mjs --point --input IN1P --current-ma 4 --tolerance-raw 1
  node scripts/hardware-fat.mjs --break --input IN1P
  node scripts/hardware-fat.mjs --soak --inputs IN1P,IN2P,IN3P --duration-seconds 3600 --max-gap-ms 4000

Options:
  --host HOST               default 192.168.50.10
  --port PORT               default 502
  --unit ID                 default 65
  --samples COUNT           default 10 for point/break
  --interval-ms MS          default 200 for point/break, 1000 for soak
  --operator NAME           required for point/break and recommended otherwise
  --device-serial SERIAL    asset identifier entered by the operator
  --evidence PATH           default commissioning-evidence

The script never writes Modbus registers.`);
    process.exit(0);
}

const modes = ["--inventory", "--point", "--break", "--soak"].filter(has);
if (modes.length !== 1) {
    throw new Error("Specify exactly one mode: --inventory, --point, --break or --soak");
}
const mode = modes[0].slice(2);
const host = valueOf("--host", "192.168.50.10");
const port = integer("--port", 502, 1, 65535);
const unit = integer("--unit", 65, 1, 247);
const operator = String(valueOf("--operator", "")).trim();
const deviceSerial = String(valueOf("--device-serial", "")).trim();
const evidenceDirectory = resolve(valueOf("--evidence", "commissioning-evidence"));
const selectedInputs = String(valueOf("--inputs", "IN1P,IN2P,IN3P"))
    .split(",")
    .map((input) => input.trim().toUpperCase())
    .filter(Boolean);

if (new Set(selectedInputs).size !== selectedInputs.length) {
    throw new Error("--inputs must not contain duplicates");
}
selectedInputs.forEach(registersForInput);

let pointInput;
let currentMa;
let toleranceRaw;
if (mode === "point" || mode === "break") {
    if (!operator) {
        throw new Error("--operator is required for point and break tests");
    }
    pointInput = String(valueOf("--input", "")).trim().toUpperCase();
    if (!pointInput) {
        throw new Error("--input is required for point and break tests");
    }
    registersForInput(pointInput);
}
if (mode === "point") {
    currentMa = integer("--current-ma", undefined, 4, 20);
    if (![4, 12, 20].includes(currentMa)) {
        throw new Error("--current-ma must be 4, 12 or 20");
    }
    toleranceRaw = integer("--tolerance-raw", undefined, 0, 160);
}

const samples = integer("--samples", 10, 1, 1000);
const intervalMs = integer("--interval-ms", mode === "soak" ? 1000 : 200, 50, 60000);
const durationSeconds = mode === "soak"
    ? integer("--duration-seconds", undefined, 1, 604800)
    : undefined;
const maxGapMs = mode === "soak"
    ? integer("--max-gap-ms", undefined, intervalMs, 600000)
    : undefined;
const invalidCodes = new Set([32767, -32768]);
const signed16 = (value) => value >= 0x8000 ? value - 0x10000 : value;
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const decodeString = (words) => Buffer.from(words.flatMap((word) => [word >> 8, word & 0xff]))
    .toString("utf8")
    .replaceAll("\0", "")
    .trim();
const gitRevision = () => {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
        return null;
    }
};
const summary = (values) => ({
    count: values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean: values.reduce((total, value) => total + value, 0) / values.length
});

const client = new ModbusRTU();
client.setTimeout(3000);
const readInput = async (address, count = 1) => (await client.readInputRegisters(address, count)).data;
const readHolding = async (address, count = 1) => (await client.readHoldingRegisters(address, count)).data;
const readValue = async (input) => signed16((await readInput(registersForInput(input).value))[0]);
const collect = async (input, count) => {
    const readings = [];
    for (let index = 0; index < count; index += 1) {
        const startedUtc = new Date().toISOString();
        const started = performance.now();
        try {
            readings.push({
                timestampUtc: startedUtc,
                raw: await readValue(input),
                latencyMs: Math.round((performance.now() - started) * 10) / 10
            });
        } catch (error) {
            readings.push({ timestampUtc: startedUtc, error: error.message });
        }
        if (index + 1 < count) {
            await delay(intervalMs);
        }
    }
    return readings;
};
const safeSection = async (operation) => {
    try {
        return { value: await operation() };
    } catch (error) {
        return { error: error.message };
    }
};

const evidence = {
    schemaVersion: 1,
    createdUtc: new Date().toISOString(),
    mode,
    readOnly: true,
    gitRevision: gitRevision(),
    operator: operator || null,
    asset: { deviceSerial: deviceSerial || null },
    target: { host, port, unit },
    parameters: { inputs: selectedInputs, pointInput, currentMa, toleranceRaw, samples, intervalMs, durationSeconds, maxGapMs }
};
const stamp = evidence.createdUtc.replaceAll(/[-:.]/g, "");
const evidencePath = resolve(evidenceDirectory, `hardware-fat-${mode}-${host}-${unit}-${stamp}.json`);

try {
    const connectedAt = performance.now();
    await client.connectTCP(host, { port });
    client.setID(unit);
    evidence.connectionLatencyMs = Math.round((performance.now() - connectedAt) * 10) / 10;

    if (mode === "inventory") {
        evidence.identity = {
            model: await safeSection(async () => decodeString(await readInput(200, 20))),
            firmwareBuild: await safeSection(async () => decodeString(await readInput(220, 25))),
            firmwareVersion: await safeSection(async () => decodeString(await readInput(250, 16))),
            serialWords: await safeSection(() => readInput(266, 6))
        };
        evidence.rs485 = {
            baudRateDividedBy100: await safeSection(async () => (await readHolding(110))[0]),
            parity: await safeSection(async () => (await readHolding(111))[0]),
            stopBits: await safeSection(async () => (await readHolding(112))[0]),
            responseDelayMs: await safeSection(async () => (await readHolding(113))[0]),
            continuousReading: await safeSection(async () => (await readHolding(114))[0]),
            slaveId: await safeSection(async () => (await readHolding(128))[0])
        };
        evidence.inputs = [];
        for (const input of selectedInputs) {
            const registers = registersForInput(input);
            evidence.inputs.push({
                ...registers,
                configuredType: signed16((await readHolding(registers.type))[0]),
                configuredLow: signed16((await readHolding(registers.scaleLow))[0]),
                configuredHigh: signed16((await readHolding(registers.scaleHigh))[0]),
                currentRaw: await readValue(input)
            });
        }
        evidence.result = "RECORDED";
        console.table(evidence.inputs);
    }

    if (mode === "point" || mode === "break") {
        evidence.readings = await collect(pointInput, samples);
        const values = evidence.readings.filter((reading) => reading.raw !== undefined).map((reading) => reading.raw);
        const readErrors = evidence.readings.filter((reading) => reading.error).length;
        evidence.statistics = values.length ? summary(values) : null;
        if (mode === "point") {
            const expectedRaw = (currentMa - 4) * 10;
            const validValues = values.filter((value) => !invalidCodes.has(value));
            evidence.acceptance = { expectedRaw, toleranceRaw };
            evidence.result = readErrors === 0
                && validValues.length === samples
                && validValues.every((value) => Math.abs(value - expectedRaw) <= toleranceRaw)
                ? "PASS"
                : "FAIL";
        } else {
            evidence.acceptance = { expectedInvalidCodes: [...invalidCodes] };
            evidence.result = readErrors === 0 && values.length === samples && values.every((value) => invalidCodes.has(value))
                ? "PASS"
                : "FAIL";
        }
        console.table(evidence.readings);
    }

    if (mode === "soak") {
        const soakStartedUtc = new Date().toISOString();
        const soakStarted = performance.now();
        const endAt = performance.now() + durationSeconds * 1000;
        const readings = Object.fromEntries(selectedInputs.map((input) => [input, []]));
        let cycles = 0;
        while (performance.now() < endAt) {
            const cycleStarted = performance.now();
            for (const input of selectedInputs) {
                const timestampUtc = new Date().toISOString();
                try {
                    readings[input].push({ timestampUtc, raw: await readValue(input) });
                } catch (error) {
                    readings[input].push({ timestampUtc, error: error.message });
                }
            }
            cycles += 1;
            const untilNextCycle = intervalMs - (performance.now() - cycleStarted);
            const untilEnd = endAt - performance.now();
            if (untilEnd > 0) {
                await delay(Math.min(Math.max(untilNextCycle, 0), untilEnd));
            }
        }
        evidence.soakTiming = {
            startedUtc: soakStartedUtc,
            completedUtc: new Date().toISOString(),
            actualDurationMs: Math.round(performance.now() - soakStarted)
        };
        evidence.cycles = cycles;
        evidence.inputs = Object.fromEntries(Object.entries(readings).map(([input, inputReadings]) => {
            const values = inputReadings.filter((reading) => reading.raw !== undefined).map((reading) => reading.raw);
            const timestamps = inputReadings.map((reading) => Date.parse(reading.timestampUtc));
            const gaps = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]);
            return [input, {
                samples: inputReadings.length,
                readErrors: inputReadings.filter((reading) => reading.error).length,
                invalidValues: values.filter((value) => invalidCodes.has(value)).length,
                maximumGapMs: gaps.length ? Math.max(...gaps) : 0,
                statistics: values.length ? summary(values) : null,
                readings: inputReadings
            }];
        }));
        evidence.acceptance = { maximumAllowedGapMs: maxGapMs };
        evidence.result = Object.values(evidence.inputs).every((input) =>
            input.readErrors === 0 && input.invalidValues === 0 && input.maximumGapMs <= maxGapMs)
            ? "PASS"
            : "FAIL";
        console.table(Object.entries(evidence.inputs).map(([input, result]) => ({ input, ...result, readings: undefined })));
    }
} catch (error) {
    evidence.result = "ERROR";
    evidence.error = error.message;
    process.exitCode = 1;
} finally {
    if (client.isOpen) {
        client.close();
    }
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Result: ${evidence.result}`);
    console.log(`Evidence: ${evidencePath}`);
    if (evidence.result === "FAIL") {
        process.exitCode = 1;
    }
}
