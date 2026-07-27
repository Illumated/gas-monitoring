"use strict";

const fs = require("node:fs");

function deriveMonitorId(hostname) {
    const monitorId = String(hostname || "").trim();
    if (!monitorId) {
        throw new Error("Host PC name is empty");
    }
    if (!/^RINIR-[A-Z0-9]{6}$/.test(monitorId)) {
        throw new Error("Host PC name must match RINIR-XXXXXX");
    }
    return monitorId;
}

function readHostName(environmentName, hostnameFile) {
    if (hostnameFile && fs.existsSync(hostnameFile)) {
        const fromFile = fs.readFileSync(hostnameFile, "utf8").trim();
        if (fromFile) return fromFile;
    }
    return String(environmentName || "").trim();
}

if (require.main === module) {
    try {
        process.stdout.write(deriveMonitorId(readHostName(process.argv[2], process.argv[3])));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { deriveMonitorId, readHostName };
