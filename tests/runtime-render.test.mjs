import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "gas-monitoring-render-"));
const target = join(directory, "flows.json");
const source = fileURLToPath(new URL("../flows/flows.json", import.meta.url));
const renderer = fileURLToPath(new URL("../docker/render-runtime-flow.cjs", import.meta.url));

try {
    const result = spawnSync(
        process.execPath,
        [renderer, source, target],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                MODBUS_HOST: "modbus-simulator",
                MODBUS_PORT: "1502",
                MODBUS_UNIT_ID: "65",
                MODBUS_POLL_INTERVAL_MS: "1000"
            }
        }
    );
    assert.equal(result.status, 0, result.stderr);

    const nodes = JSON.parse(await readFile(target, "utf8"));
    const client = nodes.find((node) => node.id === "cfg-modbus-tcp");
    assert.equal(client.tcpHost, "modbus-simulator");
    assert.equal(client.tcpPort, "1502");
    assert.equal(client.unit_id, 65);

    for (const read of nodes.filter((node) => node.type === "modbus-read")) {
        assert.equal(read.unitid, "65");
        assert.equal(read.rate, "1000");
        assert.equal(read.rateUnit, "ms");
    }
} finally {
    await rm(directory, { recursive: true, force: true });
}

console.log("Runtime flow rendering passed");
