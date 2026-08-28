import { Buffer } from "node:buffer";

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const apply = args.includes("--apply");
const confirm = valueOf("--confirm", "");
if (apply && confirm !== "APPLY") throw new Error("--apply requires --confirm APPLY");

const sourceHost = valueOf("--host", "192.168.50.10");
const targetHost = valueOf("--target-host", "192.168.50.10");
const baudRate = Number(valueOf("--baud", "9600"));
const username = valueOf("--username", process.env.USR_DR134_ADMIN_USER || "admin");
const password = valueOf("--password", process.env.USR_DR134_ADMIN_PASSWORD || "admin");
const timeoutMs = Number(valueOf("--timeout-ms", "5000"));
if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) throw new Error("invalid --timeout-ms");
if (![9600, 115200].includes(baudRate)) throw new Error("--baud must be 9600 or 115200");

const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
const request = async (host, path) => {
    const response = await fetch(`http://${host}${path}`, {
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual"
    });
    if (!response.ok) throw new Error(`USR-DR134 HTTP ${response.status} for ${path.split("?")[0]}`);
    return response.text();
};
const variable = (html, name) => {
    const matches = [...html.matchAll(new RegExp(`var\\s+${name}\\s*=\\s*(?:'([^']*)'|\"([^\"]*)\"|([^;\\s]+))\\s*;`, "g"))];
    const match = matches.find((item) => item[1] !== undefined || item[2] !== undefined || /^\d+$/.test(item[3] || ""));
    if (!match) throw new Error(`USR-DR134 parameter ${name} is missing`);
    return match[1] ?? match[2] ?? match[3];
};
const readPort = async (host) => {
    const html = await request(host, "/port.shtml");
    return {
        br: variable(html, "_br"), bc: variable(html, "bc"), parity: variable(html, "par"), stop: variable(html, "sb"),
        tlp: variable(html, "_tlp"), trp: variable(html, "_trp"), tnm: variable(html, "tnm"), mult: variable(html, "mult"),
        rip: variable(html, "rip"), umode: variable(html, "umode"), shortc: variable(html, "shortc"), shortct: variable(html, "_shortct"),
        cmode: variable(html, "cmode"), cnum: variable(html, "_cnum"), htpch: variable(html, "htpch"),
        htpot: variable(html, "_htpot"), htpcoh: variable(html, "htpcoh")
    };
};
const readNetwork = async (host) => {
    const html = await request(host, "/network.shtml");
    const octets = (prefix) => [1, 2, 3, 4].map((index) => variable(html, `_${prefix}${index}`));
    return { staticip: variable(html, "staticip"), sip: octets("sip"), mask: octets("mip"), gateway: octets("gip"), dns: octets("dip") };
};
const write = async (host, endpoint, values) => request(host, `/${endpoint}.cgi?${new URLSearchParams(values)}`);
const hostOctets = targetHost.split(".");
if (hostOctets.length !== 4 || hostOctets.some((value) => !/^\d+$/.test(value) || Number(value) > 255)) throw new Error("invalid --target-host");

const before = { port: await readPort(sourceHost), network: await readNetwork(sourceHost) };
if (!apply) {
    console.log(JSON.stringify({ status: "read-only", host: sourceHost, port: before.port, network: before.network }));
    process.exit(0);
}

// Сначала меняются serial-параметры; IP применяется последним, поскольку HTTP-соединение после этого разрывается.
const port = { ...before.port, br: String(baudRate), bc: "8", parity: "0", stop: "2", tlp: "502", tnm: "1" };
await write(sourceHost, "port", port);
const network = {
    staticip: "1",
    sip1: hostOctets[0], sip2: hostOctets[1], sip3: hostOctets[2], sip4: hostOctets[3],
    mip1: "255", mip2: "255", mip3: "255", mip4: "0",
    gip1: "192", gip2: "168", gip3: "50", gip4: "1",
    dip1: "192", dip2: "168", dip3: "50", dip4: "1"
};
if (sourceHost !== targetHost || before.network.staticip !== "1") await write(sourceHost, "network", network);
await write(sourceHost, "manage", { reset: "1", rup: "", rfp: "" });
console.log(JSON.stringify({ status: "configured", sourceHost, targetHost, serial: `${baudRate} 8N2`, tcpPort: 502 }));
