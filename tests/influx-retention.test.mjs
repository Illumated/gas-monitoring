import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../docker/configure-influx-retention.cjs", import.meta.url));
const run = (retention) => spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
        ...process.env,
        INFLUXDB_URL: "http://127.0.0.1:1",
        INFLUXDB_ORG: "rinir",
        INFLUXDB_BUCKET: "wb",
        INFLUXDB_TOKEN: "test",
        INFLUXDB_RETENTION: retention
    }
});

const invalid = run("1year");
assert.notEqual(invalid.status, 0);
assert.match(invalid.stderr, /must use h, d or w/);

const tooShort = run("0h");
assert.notEqual(tooShort.status, 0);
assert.match(tooShort.stderr, /at least 1h/);

const valid = run("8760h");
assert.notEqual(valid.status, 0);
assert.doesNotMatch(valid.stderr, /INFLUXDB_RETENTION/);

console.log("InfluxDB retention validation passed");
