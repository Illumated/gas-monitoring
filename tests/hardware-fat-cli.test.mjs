import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/hardware-fat.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

const help = run("--help");
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /never writes Modbus registers/);

const noMode = run();
assert.notEqual(noMode.status, 0);
assert.match(noMode.stderr, /exactly one mode/);

const ambiguousMode = run("--inventory", "--soak", "--duration-seconds", "1");
assert.notEqual(ambiguousMode.status, 0);
assert.match(ambiguousMode.stderr, /exactly one mode/);

const noMaximumGap = run("--soak", "--duration-seconds", "1");
assert.notEqual(noMaximumGap.status, 0);
assert.match(noMaximumGap.stderr, /--max-gap-ms/);

const noOperator = run("--point", "--input", "IN1P", "--current-ma", "4", "--tolerance-raw", "1");
assert.notEqual(noOperator.status, 0);
assert.match(noOperator.stderr, /--operator is required/);

const noTolerance = run("--point", "--input", "IN1P", "--current-ma", "4", "--operator", "FAT");
assert.notEqual(noTolerance.status, 0);
assert.match(noTolerance.stderr, /--tolerance-raw/);

const invalidPoint = run("--point", "--input", "IN1P", "--current-ma", "8", "--tolerance-raw", "1", "--operator", "FAT");
assert.notEqual(invalidPoint.status, 0);
assert.match(invalidPoint.stderr, /4, 12 or 20/);

console.log("Hardware FAT CLI safety gates passed");
