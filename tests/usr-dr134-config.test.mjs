import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const portPage = `<script>
var _br=115200;var bc=8;var par=0;var sb=2;var _tlp=502;var _trp=8234;var tnm=1;var mult=0;
var rip='192.168.0.201';var umode=0;var shortc=0;var _shortct=3;var cmode=0;var _cnum=4;
var htpch=0;var _htpot=10;var htpcoh=0;
</script>`;
const networkPage = `<script>
var staticip=1;var _sip1=192;var _sip2=168;var _sip3=0;var _sip4=7;
var _mip1=255;var _mip2=255;var _mip3=255;var _mip4=0;
var _gip1=192;var _gip2=168;var _gip3=0;var _gip4=1;
var _dip1=192;var _dip2=168;var _dip3=0;var _dip4=1;
</script>`;
const requests = [];
const server = createServer((request, response) => {
    requests.push(request.url);
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(request.url.startsWith("/port.shtml") ? portPage : request.url.startsWith("/network.shtml") ? networkPage : "OK");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const script = fileURLToPath(new URL("../scripts/usr-dr134-config.mjs", import.meta.url));
const run = (extra) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "--host", `127.0.0.1:${port}`, "--target-host", "192.168.50.10", ...extra], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => stdout += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    child.on("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
});

try {
    const readOnly = JSON.parse(await run([]));
    assert.equal(readOnly.port.br, "115200");
    requests.length = 0;
    await run(["--apply", "--confirm", "APPLY", "--baud", "9600"]);
    assert.ok(requests.some((url) => url.startsWith("/port.cgi?") && url.includes("br=9600") && url.includes("stop=2")));
    assert.ok(requests.some((url) => url.startsWith("/network.cgi?") && url.includes("sip4=10")));
    assert.ok(requests.some((url) => url.startsWith("/manage.cgi?") && url.includes("reset=1")));
} finally {
    server.close();
}

console.log("USR-DR134 configuration contract passed");
