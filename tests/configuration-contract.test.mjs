import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import capacity from "../scripts/storage-capacity.mjs";

const [compose, envExample, configuration, settings] = await Promise.all([
    readFile(new URL("../docker/compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../docs/configuration.md", import.meta.url), "utf8"),
    readFile(new URL("../config/settings.example.js", import.meta.url), "utf8")
]);

for (const name of ["MONITOR_ID", "SITE_NAME", "LOCATION_NAME"]) {
    assert.match(envExample, new RegExp(`^${name}=.+$`, "m"), `${name} must have an example`);
    assert.match(compose, new RegExp(`${name}: \\\${${name}:\\?`), `${name} must be required by Compose`);
    assert.match(configuration, new RegExp(`\\\`${name}\\\``), `${name} must be documented`);
}

assert.match(settings, /contextStorage[\s\S]*localfilesystem/, "runtime settings must use persistent Node-RED context");
assert.equal(capacity.pointsPerYear, 94_608_000);
assert.ok(capacity.recommendedInfluxVolumeGiB >= capacity.compressedDataScenarios.at(-1).gib * 3);

console.log("Configuration, persistent context and annual capacity contracts passed");
