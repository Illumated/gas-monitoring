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
                MODBUS_POLL_INTERVAL_MS: "1000",
                MODBUS_COMMAND_DELAY_MS: "300",
                GAS_STALE_TIMEOUT_MS: "4000",
                MONITOR_ID: "RINIR-ICU-F02-01",
                SITE_NAME: "Городская больница",
                LOCATION_NAME: "Реанимация, 2 этаж"
            }
        }
    );
    assert.equal(result.status, 0, result.stderr);

    const nodes = JSON.parse(await readFile(target, "utf8"));
    const client = nodes.find((node) => node.id === "cfg-modbus-tcp");
    assert.equal(client.tcpHost, "modbus-simulator");
    assert.equal(client.tcpPort, "1502");
    assert.equal(client.unit_id, 65);
    assert.equal(client.commandDelay, "300");

    const pollCycle = nodes.find((node) => node.id === "poll-cycle");
    const sequencer = nodes.find((node) => node.id === "poll-sequencer");
    assert.equal(pollCycle.repeat, "1");
    for (const sequence of sequencer.sequences) {
        assert.equal(sequence.unitid, "65");
    }

    const invalidQueue = spawnSync(
        process.execPath,
        [renderer, source, target],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                MODBUS_POLL_INTERVAL_MS: "1000",
                MODBUS_COMMAND_DELAY_MS: "400",
                GAS_STALE_TIMEOUT_MS: "4000",
                MONITOR_ID: "RINIR-ICU-F02-01",
                SITE_NAME: "Городская больница",
                LOCATION_NAME: "Реанимация, 2 этаж"
            }
        }
    );
    assert.notEqual(invalidQueue.status, 0);
    assert.match(invalidQueue.stderr, /MODBUS_COMMAND_DELAY_MS \* 3/);

    const invalidStale = spawnSync(
        process.execPath,
        [renderer, source, target],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                MODBUS_POLL_INTERVAL_MS: "1000",
                MODBUS_COMMAND_DELAY_MS: "300",
                GAS_STALE_TIMEOUT_MS: "2000",
                MONITOR_ID: "RINIR-ICU-F02-01",
                SITE_NAME: "Городская больница",
                LOCATION_NAME: "Реанимация, 2 этаж"
            }
        }
    );
    assert.notEqual(invalidStale.status, 0);
    assert.match(invalidStale.stderr, /GAS_STALE_TIMEOUT_MS/);

    const invalidIdentity = spawnSync(
        process.execPath,
        [renderer, source, target],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                MODBUS_POLL_INTERVAL_MS: "1000",
                MODBUS_COMMAND_DELAY_MS: "300",
                GAS_STALE_TIMEOUT_MS: "4000",
                MONITOR_ID: "РЕАНИМАЦИЯ 2",
                SITE_NAME: "Городская больница",
                LOCATION_NAME: "Реанимация, 2 этаж"
            }
        }
    );
    assert.notEqual(invalidIdentity.status, 0);
    assert.match(invalidIdentity.stderr, /MONITOR_ID/);
} finally {
    await rm(directory, { recursive: true, force: true });
}

console.log("Runtime flow rendering passed");
