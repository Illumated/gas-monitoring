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
    "00-прочитать-сначала.md", "01-развертывание-стенда.md", "02-заводская-установка.md",
    "03-сеть.md", "04-схема-подключения.md", "05-настройка-usr-dr134.md",
    "06-настройка-wb-mai6.md", "07-конфигурация.md", "08-аппаратный-fat.md",
    "09-проверка-релиза.md", "10-эксплуатация.md", "11-резервное-копирование-и-восстановление.md",
    "12-диагностика.md", "13-сервисная-консоль.md", "14-уведомления-max.md"
]) {
    await access(resolve(root, "docs", document));
}

const readme = await readFile(resolve(root, "README.md"), "utf8");
assert.match(readme, /docs\/00-прочитать-сначала\.md/);
assert.match(readme, /docs\/01-развертывание-стенда\.md/);

const factoryGuide = await readFile(resolve(root, "docs", "02-заводская-установка.md"), "utf8");
for (const required of ["USBImager", "Get-FileHash", "RINIR-13.6.0-amd64.iso", "DD Image mode", "UEFI:"]) {
    assert.ok(factoryGuide.includes(required), `Windows USB guide must document ${required}`);
}
for (const required of ["build-windows.ps1", "Docker Desktop", "Git for Windows", "BUILD-INFO.txt", "SourceIso"]) {
    assert.ok(factoryGuide.includes(required), `Windows image build guide must document ${required}`);
}

console.log(`Documentation links and ${markdownFiles.length} Markdown files passed`);
