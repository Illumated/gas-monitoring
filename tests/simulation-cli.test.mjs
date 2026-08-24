import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../scripts/simulation.ps1", import.meta.url), "utf8");

assert.match(script, /ValidateSet\("start", "status", "normal", "zero", "warning", "oxygenalarm", "alarm", "nodata", "stop"\)/);
assert.match(script, /docker\\compose\.fat\.yaml/);
assert.match(script, /"up", "-d", "--build"/);
assert.match(script, /Wait-Healthy \$container/);
assert.match(script, /"down", "--remove-orphans"/);
assert.doesNotMatch(script, /"down"[\s\S]*"-v"/, "simulation stop must preserve persistent volumes");
assert.match(script, /fat\.ps1"\) -Scenario \$Action/);

console.log("Simulation CLI contract passed");
