import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
    versions,
    preseed,
    provisioning,
    firstboot,
    appService,
    installer,
    nginx,
    firewall,
    kiosk,
    factoryExample,
    docs,
    bundle,
    image,
    windowsBuilder,
    isoBuildScript,
    isoBuilder,
    windowsContainer
] = await Promise.all([
    read("../factory/versions.env"),
    read("../factory/preseed.cfg"),
    read("../factory/provision.sh"),
    read("../deploy/debian/firstboot.sh"),
    read("../deploy/debian/gas-monitoring.service"),
    read("../deploy/debian/install-system.sh"),
    read("../deploy/debian/nginx-gas-monitoring.conf"),
    read("../deploy/debian/nftables.conf"),
    read("../deploy/debian/gas-monitoring-kiosk.service"),
    read("../deploy/debian/factory.env.example"),
    read("../docs/02-factory-installation.md"),
    read("../factory/build-bundle.sh"),
    read("../docker/node-red/Dockerfile"),
    read("../factory/build-windows.ps1"),
    read("../factory/build-iso.sh"),
    read("../factory/Dockerfile.windows-builder"),
    read("../factory/build-windows-container.sh")
]);

for (const expected of [
    "DEBIAN_RELEASE=13.6.0",
    "DEBIAN_ARCH=amd64",
    "DOCKER_CE_VERSION=5:29.6.2-1~debian.13~trixie",
    "SALT_VERSION=3008.2",
    "FACTORY_BUILDER_IMAGE=debian:13-slim@sha256:"
]) {
    assert.match(versions, new RegExp(expected.replaceAll(".", "\\.")));
}

assert.match(preseed, /partman\/early_command/);
assert.match(preseed, /\/sys\/block\/\$block\/removable/);
assert.match(preseed, /partman\/confirm_nooverwrite boolean true/);
assert.match(preseed, /passwd\/root-login boolean false/);
assert.match(provisioning, /sha256sum --check SHA256SUMS/);
assert.match(provisioning, /apt-mark hold[\s\S]*salt-common salt-minion/);
assert.match(provisioning, /docker load --input/);

assert.match(firstboot, /exactly two physical Ethernet interfaces are required/);
assert.match(firstboot, /RINIR-%s/);
assert.match(firstboot, /Name=rinir-mgmt/);
assert.match(firstboot, /Name=rinir-modbus/);
assert.match(firstboot, /systemctl enable salt-minion\.service/);
assert.doesNotMatch(appService, /salt-minion/, "application startup must not depend on Salt");

assert.match(installer, /openssl req -x509/);
assert.match(installer, /factory-credentials\.txt/);
assert.match(installer, /autologin-user=rinir-kiosk/);
assert.match(nginx, /auth_request \/__auth/);
assert.match(nginx, /127\.0\.0\.1:18082\/verify/);
assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:1880/);
assert.match(firewall, /iifname "rinir-mgmt" tcp dport 443 accept/);
assert.doesNotMatch(firewall, /rinir-modbus" tcp dport 443 accept/);
assert.match(kiosk, /chromium --kiosk/);
assert.match(kiosk, /dashboard\/monitoring/);

for (const name of [
    "MANAGEMENT_INTERFACE",
    "MODBUS_INTERFACE",
    "MODBUS_ADDRESS",
    "SALT_MASTER",
    "REMOTE_USER",
    "ADMIN_ACCESS_CODE",
    "NODE_RED_ADMIN_PASSWORD",
    "REMOTE_INITIAL_PASSWORD"
]) {
    assert.match(factoryExample, new RegExp(`^${name}=`, "m"));
    assert.ok(docs.includes(`\`${name}\``), `${name} must be documented`);
}

assert.match(installer, /admin_code="\$ADMIN_ACCESS_CODE"/);
assert.match(installer, /admin_password="\$NODE_RED_ADMIN_PASSWORD"/);
assert.match(installer, /remote_password="\$REMOTE_INITIAL_PASSWORD"/);
assert.match(bundle, /docker build[\s\S]*gas-monitoring-node-red:0\.1\.0/);
assert.doesNotMatch(bundle, /compose\.production\.yaml[\s\S]*build node-red/);
assert.match(image, /tools\/wb-mai6-commission\.mjs/);
assert.match(image, /tools\/hardware-fat\.mjs/);
assert.match(installer, /gas-monitoring-acceptance\.service/);
assert.match(windowsBuilder, /Get-FileHash -Algorithm SHA256/);
assert.match(windowsBuilder, /Docker Desktop must use Linux amd64 containers/);
assert.match(windowsBuilder, /BUILD-INFO\.txt|Factory ISO created and verified/);
assert.match(windowsBuilder, /Output directory must be outside the repository/);
assert.match(isoBuilder, /xorriso/);
assert.match(isoBuilder, /docker:29\.6\.2-cli@sha256:/);
assert.match(windowsContainer, /tr -d '\\r'/);
assert.match(windowsContainer, /replace-with-/);
assert.match(windowsContainer, /ADMIN_ACCESS_CODE must contain at least 10 characters/);
assert.match(windowsContainer, /may contain only A-Z/);
assert.match(windowsBuilder, /Factory build evidence was not created/);
assert.doesNotMatch(windowsBuilder, /SourceSha256/);
assert.doesNotMatch(windowsContainer, /SOURCE_SHA256/);
assert.doesNotMatch(isoBuildScript, /SOURCE_SHA256/);

console.log("Factory installation, network, Salt independence and kiosk contracts passed");
