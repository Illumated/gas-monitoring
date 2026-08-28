import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const device = valueOf("--device", "");
if (!["mai6", "relay"].includes(device)) throw new Error("--device must be mai6 or relay");
if (valueOf("--confirm", "") !== "APPLY") throw new Error("--confirm APPLY is required");
const host = valueOf("--host", process.env.MODBUS_HOST || "192.168.50.10");
const port = valueOf("--port", process.env.MODBUS_PORT || "502");
const mai6Unit = valueOf("--mai6-unit", "65");
const relayUnit = valueOf("--relay-unit", "66");
const toolsDirectory = dirname(fileURLToPath(import.meta.url));

const run = (script, childArgs) => new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(toolsDirectory, script), ...childArgs], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => stdout += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    child.on("exit", (code) => code === 0 ? resolveRun(stdout.trim()) : rejectRun(new Error(stderr.trim() || `${script} exited with ${code}`)));
});
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const gateway = (baud) => run("usr-dr134-config.mjs", ["--apply", "--confirm", "APPLY", "--host", host, "--target-host", host, "--baud", String(baud)]);
const wb = (mode) => run("wb-autoconfigure.mjs", [mode, "--device", device, "--host", host, "--port", port, "--mai6-unit", mai6Unit, "--relay-unit", relayUnit, "--skip-env-update", "--evidence", "/data/commissioning-evidence"]);

try {
    await gateway(9600);
    await wait(4000);
    await wb("--apply");
    await gateway(115200);
    await wait(4000);
    await wb("--verify-only");
    console.log(JSON.stringify({ status: "configured", device, unitId: Number(device === "mai6" ? mai6Unit : relayUnit) }));
} catch (error) {
    // Возврат рабочего профиля шлюза выполняется даже после ошибки настройки WB.
    try { await gateway(115200); } catch {}
    throw error;
}
