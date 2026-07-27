"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { deriveMonitorId, readHostName } = require("../docker/derive-monitor-id.cjs");

assert.equal(deriveMonitorId("RINIR-A1B2C3"), "RINIR-A1B2C3");
for (const invalid of [
    "",
    "rinir-A1B2C3",
    "RINIR-A1B2C",
    "RINIR-A1B2C34",
    "RINIR-A1B-23",
    "WINDOWS-PC"
]) {
    assert.throws(() => deriveMonitorId(invalid), /RINIR-XXXXXX|empty/);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gas-monitoring-hostname-"));
const hostnameFile = path.join(directory, "hostname");
try {
    fs.writeFileSync(hostnameFile, "RINIR-C4D5E6\n");
    assert.equal(
        readHostName("RINIR-TEST01", hostnameFile),
        "RINIR-C4D5E6",
        "mounted Debian /etc/hostname must take precedence over the test environment value"
    );
    assert.equal(readHostName("RINIR-TEST01", path.join(directory, "missing")), "RINIR-TEST01");
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}

console.log("Debian hostname monitor identity contract passed");
