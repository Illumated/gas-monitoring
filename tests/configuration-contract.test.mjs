import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import capacity from "../scripts/storage-capacity.mjs";

const [compose, productionCompose, fatCompose, envExample, configuration, engineering, settings] = await Promise.all([
    readFile(new URL("../docker/compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../docker/compose.production.yaml", import.meta.url), "utf8"),
    readFile(new URL("../docker/compose.fat.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../docs/07-configuration.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/13-engineering-console.md", import.meta.url), "utf8"),
    readFile(new URL("../config/settings.example.js", import.meta.url), "utf8")
]);

for (const name of ["MONITOR_ID", "SITE_NAME", "LOCATION_NAME"]) {
    assert.doesNotMatch(envExample, new RegExp(`^${name}=`, "m"), `${name} must not be configured in .env`);
}

assert.match(compose, /HOST_HOSTNAME_FILE: \/run\/host-hostname/);
assert.match(productionCompose, /\/etc\/hostname:\/run\/host-hostname:ro/);
assert.match(fatCompose, /HOST_MACHINE_NAME: RINIR-TEST01/);
assert.match(configuration, /Debian hostname/);
assert.match(configuration, /не формирует и не изменяет|только проверяет и использует/);
assert.doesNotMatch(configuration, /set-rinir-hostname/);
assert.match(engineering, /Название больницы/);
assert.match(engineering, /Расположение/);
assert.match(settings, /contextStorage[\s\S]*localfilesystem/, "runtime settings must use persistent Node-RED context");
assert.equal(capacity.pointsPerYear, 78_840_000);
assert.ok(capacity.recommendedInfluxVolumeGiB >= capacity.compressedDataScenarios.at(-1).gib * 3);

console.log("Configuration, persistent context and annual capacity contracts passed");
