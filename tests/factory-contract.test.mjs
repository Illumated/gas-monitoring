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
    docs
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
    read("../docs/factory-installation.md")
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
assert.match(nginx, /auth_basic_user_file/);
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
    "REMOTE_USER"
]) {
    assert.match(factoryExample, new RegExp(`^${name}=`, "m"));
    assert.ok(docs.includes(`\`${name}\``), `${name} must be documented`);
}

console.log("Factory installation, network, Salt independence and kiosk contracts passed");
