import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const entries = await readdir(root, { recursive: true, withFileTypes: true });
const markdownFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
    .map((entry) => resolve(entry.parentPath, entry.name))
    .filter((path) => !path.includes("node_modules"));

const failures = [];
for (const file of markdownFiles) {
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const destination = match[1].trim().replace(/^<|>$/g, "");
        if (/^(?:https?:|mailto:|#)/i.test(destination)) {
            continue;
        }
        const target = decodeURIComponent(destination.split("#", 1)[0]);
        try {
            await access(resolve(dirname(file), target));
        } catch {
            failures.push(`${file}: missing ${destination}`);
        }
    }
}

assert.deepEqual(failures, [], failures.join("\n"));

for (const document of [
    "00-read-first.md", "01-stand-deployment.md", "02-factory-installation.md",
    "03-network.md", "04-wiring.md", "05-usr-dr134-commissioning.md",
    "06-wb-mai6-commissioning.md", "07-configuration.md", "08-hardware-fat.md",
    "09-release-verification.md", "10-operations.md", "11-backup-restore.md",
    "12-troubleshooting.md", "13-engineering-console.md", "14-max-notifications.md"
]) {
    await access(resolve(root, "docs", document));
}

const readme = await readFile(resolve(root, "README.md"), "utf8");
assert.match(readme, /docs\/00-read-first\.md/);
assert.match(readme, /docs\/01-stand-deployment\.md/);

const factoryGuide = await readFile(resolve(root, "docs", "02-factory-installation.md"), "utf8");
for (const required of ["USBImager", "Get-FileHash", "RINIR-13.6.0-amd64.iso", "DD Image mode", "UEFI:"]) {
    assert.ok(factoryGuide.includes(required), `Windows USB guide must document ${required}`);
}
for (const required of ["build-windows.ps1", "Docker Desktop", "BUILD-INFO.txt", "SHA256SUMS.sign"]) {
    assert.ok(factoryGuide.includes(required), `Windows image build guide must document ${required}`);
}

console.log(`Documentation links and ${markdownFiles.length} Markdown files passed`);
