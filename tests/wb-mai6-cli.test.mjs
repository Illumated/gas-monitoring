import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/wb-mai6-commission.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

const list = run("--list");
assert.equal(list.status, 0, list.stderr);
assert.match(list.stdout, /IN4P/);
assert.match(list.stdout, /IN6N/);

const implicitApply = run("--apply", "--confirm", "APPLY");
assert.notEqual(implicitApply.status, 0);
assert.match(implicitApply.stderr, /explicit --inputs/);

const unconfirmedApply = run("--apply", "--inputs", "IN1P");
assert.notEqual(unconfirmedApply.status, 0);
assert.match(unconfirmedApply.stderr, /--confirm APPLY/);

console.log("WB-MAI6 CLI safety gates passed");
