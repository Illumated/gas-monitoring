import { readFile } from "node:fs/promises";

const path = new URL("../flows/flows.json", import.meta.url);
const nodes = JSON.parse(await readFile(path, "utf8"));
const counts = new Map();

for (const node of nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
}

const modbusReads = nodes
    .filter((node) => node.type === "modbus-read")
    .map(({ name, topic, unitid, dataType, adr, quantity, rate, rateUnit }) => ({
        name,
        topic,
        unitid,
        dataType,
        address: adr,
        quantity,
        rate: `${rate} ${rateUnit}`
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
    modbusReads,
    orphanUiBase
}, null, 2));
