"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gas-monitoring-auth-"));
const dataFile = path.join(temporary, "users.json");
const port = 20000 + (process.pid % 10000);
const adminToken = "test-auth-admin-token";
const child = spawn(process.execPath, [path.join(__dirname, "../docker/auth-service.cjs")], {
    env: {
        ...process.env,
        AUTH_SERVICE_PORT: String(port),
        AUTH_SERVICE_DATA_FILE: dataFile,
        AUTH_SERVICE_TOKEN: adminToken,
        REMOTE_INITIAL_USER: "operator",
        REMOTE_INITIAL_PASSWORD: "initial-password"
    },
    stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

async function waitForServer() {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/health`);
            if (response.ok) return;
        } catch {
            // Сервер ещё запускается.
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Auth service did not start: ${stderr}`);
}

function basic(username, password) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function api(pathname, options = {}) {
    return fetch(`http://127.0.0.1:${port}${pathname}`, options);
}

(async () => {
    try {
        await waitForServer();

        assert.equal((await api("/verify")).status, 401);
        assert.equal((await api("/verify", { headers: { Authorization: basic("operator", "wrong") } })).status, 401);
        assert.equal((await api("/verify", { headers: { Authorization: basic("operator", "initial-password") } })).status, 204);
        assert.equal((await api("/users")).status, 403);

        const list = await api("/users", { headers: { "X-Auth-Admin-Token": adminToken } });
        assert.equal(list.status, 200);
        assert.deepEqual((await list.json()).users.map((item) => item.username), ["operator"]);

        const created = await api("/users", {
            method: "POST",
            headers: { "X-Auth-Admin-Token": adminToken, "Content-Type": "application/json" },
            body: JSON.stringify({ username: "doctor.one", password: "doctor-password" })
        });
        assert.equal(created.status, 201);
        assert.equal((await api("/verify", { headers: { Authorization: basic("doctor.one", "doctor-password") } })).status, 204);

        const removed = await api("/users/operator", {
            method: "DELETE",
            headers: { "X-Auth-Admin-Token": adminToken }
        });
        assert.equal(removed.status, 200);
        const lastUserRemoval = await api("/users/doctor.one", {
            method: "DELETE",
            headers: { "X-Auth-Admin-Token": adminToken }
        });
        assert.equal(lastUserRemoval.status, 409);

        const persisted = fs.readFileSync(dataFile, "utf8");
        assert.doesNotMatch(persisted, /initial-password|doctor-password/);
        assert.match(persisted, /scrypt\$/);
        console.log("Remote authentication service contract passed");
    } finally {
        child.kill();
        fs.rmSync(temporary, { recursive: true, force: true });
    }
})().catch((error) => {
    child.kill();
    fs.rmSync(temporary, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
});
