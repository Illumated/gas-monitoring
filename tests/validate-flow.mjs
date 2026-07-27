import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const path = new URL("../flows/flows.json", import.meta.url);
const nodes = JSON.parse(await readFile(path, "utf8"));

assert.ok(Array.isArray(nodes), "flows/flows.json must contain a JSON array");
assert.ok(nodes.length > 0, "flow must contain at least one object");

const ids = nodes.map((node) => node.id);
assert.equal(new Set(ids).size, ids.length, "node IDs must be unique");

const idSet = new Set(ids);
const missingWireTargets = [];

for (const node of nodes) {
    assert.equal(typeof node.id, "string", "every object must have a string id");
    assert.equal(typeof node.type, "string", `object ${node.id} must have a type`);

    for (const output of node.wires ?? []) {
        for (const target of output ?? []) {
            if (!idSet.has(target)) {
                missingWireTargets.push(`${node.id} -> ${target}`);
            }
        }
    }
}

assert.deepEqual(missingWireTargets, [], "all wire targets must exist");
assert.ok(nodes.some((node) => node.type === "tab"), "flow must contain a tab");

console.log(`Flow validation passed: ${nodes.length} objects, ${ids.length} unique IDs`);
