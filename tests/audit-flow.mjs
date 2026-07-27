import { readFile } from "node:fs/promises";

const path = new URL("../flows/flows.json", import.meta.url);
const nodes = JSON.parse(await readFile(path, "utf8"));
const counts = new Map();

for (const node of nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
}

const modbusSequencers = nodes
    .filter((node) => node.type === "modbus-flex-sequencer")
    .map(({ name, server, sequences }) => ({
        name,
        server,
        sequences
    }));

const orphanUiBase = nodes
    .filter((node) => node.type === "ui_base")
    .map((node) => ({
        id: node.id,
        references: nodes.filter((candidate) =>
            JSON.stringify(candidate).includes(`"${node.id}"`)
        ).length - 1
    }));

console.log(JSON.stringify({
    objects: nodes.length,
    types: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    modbusSequencers,
    orphanUiBase
}, null, 2));
