import ModbusRTU from "@openp4nr/modbus-serial";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { allInputs, registersForInput } from "./lib/wb-mai6-map.mjs";

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
    console.log(`Usage:
  node scripts/wb-mai6-commission.mjs --list
  node scripts/wb-mai6-commission.mjs --read-only [--inputs IN1P,IN2P]
  node scripts/wb-mai6-commission.mjs --apply --inputs IN1P,IN2P --confirm APPLY

Options:
  --host HOST       default 192.168.50.10
  --port PORT       default 502
  --unit ID         default 65
  --inputs LIST     comma-separated IN1P..IN6P and IN1N..IN6N
  --all-p           select IN1P..IN6P
  --all             select all 12 single-ended inputs
  --type VALUE      default 4866 (4-20 mA)
  --low VALUE       default 0
  --high VALUE      default 160
  --evidence PATH   default commissioning-evidence`);
    process.exit(0);
}

if (has("--list")) {
    console.table(allInputs.map(registersForInput));
    process.exit(0);
}

const apply = has("--apply");
if (apply === has("--read-only")) {
    throw new Error("Specify exactly one mode: --read-only or --apply");
}

const explicitlySelected = has("--inputs") || has("--all-p") || has("--all");
if (apply && !explicitlySelected) {
    throw new Error("--apply requires explicit --inputs, --all-p or --all");
}
if (apply && valueOf("--confirm", "") !== "APPLY") {
    throw new Error("--apply requires --confirm APPLY");
}

const selected = has("--all")
    ? allInputs
    : has("--all-p")
        ? allInputs.filter((input) => input.endsWith("P"))
        : String(valueOf("--inputs", "IN1P,IN2P,IN3P"))
            .split(",")
            .map((input) => input.trim().toUpperCase())
            .filter(Boolean);
const uniqueInputs = [...new Set(selected)];
const registerMap = uniqueInputs.map(registersForInput);

const host = valueOf("--host", "192.168.50.10");
const port = integer("--port", 502, 1, 65535);
const unit = integer("--unit", 65, 1, 247);
const sensorType = integer("--type", 4866, 0, 65535);
const scaleLow = integer("--low", 0, -32768, 32767);
const scaleHigh = integer("--high", 160, -32768, 32767);
if (scaleLow >= scaleHigh) {
    throw new Error("--low must be less than --high");
}

const evidenceDirectory = resolve(valueOf("--evidence", "commissioning-evidence"));
const stamp = new Date().toISOString().replaceAll(/[-:.]/g, "").replace("Z", "Z");
const evidencePath = resolve(evidenceDirectory, `wb-mai6-${host}-${unit}-${stamp}.json`);
const client = new ModbusRTU();
client.setTimeout(3000);

const signed16 = (value) => value >= 0x8000 ? value - 0x10000 : value;
const readOne = async (register, table) => {
    const response = table === "holding"
        ? await client.readHoldingRegisters(register, 1)
        : await client.readInputRegisters(register, 1);
    return signed16(response.data[0]);
};
const snapshot = async () => Promise.all(registerMap.map(async (registers) => ({
    ...registers,
    configuredType: await readOne(registers.type, "holding"),
    configuredLow: await readOne(registers.scaleLow, "holding"),
    configuredHigh: await readOne(registers.scaleHigh, "holding"),
    currentValue: await readOne(registers.value, "input")
})));

const evidence = {
    createdUtc: new Date().toISOString(),
    target: { host, port, unit },
    requested: { inputs: uniqueInputs, sensorType, scaleLow, scaleHigh },
    mode: apply ? "apply" : "read-only"
};

try {
    await client.connectTCP(host, { port });
    client.setID(unit);
    evidence.before = await snapshot();

    if (apply) {
        for (const registers of registerMap) {
            await client.writeRegister(registers.type, sensorType);
            await client.writeRegister(registers.scaleLow, scaleLow & 0xffff);
            await client.writeRegister(registers.scaleHigh, scaleHigh & 0xffff);
        }
        evidence.after = await snapshot();
        for (const input of evidence.after) {
            if (input.configuredType !== sensorType || input.configuredLow !== scaleLow || input.configuredHigh !== scaleHigh) {
                throw new Error(`Readback verification failed for ${input.input}`);
            }
        }
    }
    console.table(evidence.after || evidence.before);
} catch (error) {
    evidence.error = error.message;
    throw error;
} finally {
    if (client.isOpen) {
        client.close();
    }
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
    console.log(`Evidence: ${evidencePath}`);
}
