import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);

const findings = [];
const ignoredValues = /^(?:|replace-|test-|software-fat-|<|\$\{)/i;
const secretNames = /(?:TOKEN|PASSWORD|SECRET|ACCESS_CODE)$/;
const localSecrets = [];

if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || !secretNames.test(match[1])) continue;
        const value = match[2].trim();
        if (value.length >= 12 && !ignoredValues.test(value)) localSecrets.push({ name: match[1], value });
    }
}

for (const file of tracked) {
    const content = readFileSync(file, "utf8");
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
        findings.push(`${file}: private key marker`);
    }
    for (const secret of localSecrets) {
        if (content.includes(secret.value)) findings.push(`${file}: contains local value of ${secret.name}`);
    }
    for (const [index, line] of content.split(/\r?\n/).entries()) {
        const match = line.match(/^\s*(MAX_BOT_TOKEN|INFLUXDB_TOKEN|INFLUXDB_PASSWORD|NODE_RED_CREDENTIAL_SECRET|SERVICE_ACCESS_CODE)\s*[:=]\s*["']?([^"'#\s]+)["']?\s*$/);
        if (!match) continue;
        const value = match[2];
        if (value.length >= 12 && !ignoredValues.test(value)) {
            findings.push(`${file}:${index + 1}: suspicious assigned value for ${match[1]}`);
        }
    }
}

if (findings.length) {
    console.error(`Secret scan failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
    process.exit(1);
}

console.log(`Secret scan passed: ${tracked.length} repository files, ${localSecrets.length} local secret values compared without disclosure`);
