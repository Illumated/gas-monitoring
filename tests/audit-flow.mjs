import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path = new URL("../flows/flows.json", import.meta.url);
const contents = await readFile(path);
const nodes = JSON.parse(contents.toString("utf8"));
const counts = new Map();

for (const node of nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
}

const modbusReaders = nodes
    .filter((node) => node.type === "modbus-flex-getter")
    .map(({ name, server }) => ({
        name,
        server
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
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex").toUpperCase(),
    objects: nodes.length,
    types: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    modbusReaders,
    orphanUiBase
}, null, 2));
