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
    windowsContainer,
    grubBoot,
    isolinuxBoot,
    diskSelector,
    acceptance
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
    read("../factory/build-windows-container.sh"),
    read("../factory/boot/grub.cfg"),
    read("../factory/boot/isolinux.cfg"),
    read("../factory/select-install-disk.sh"),
    read("../deploy/debian/acceptance.sh")
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
assert.match(preseed, /auto-install\/enable boolean true/);
assert.match(preseed, /^#_preseed_V1/m);
assert.match(preseed, /auto-install\/cloak_initrd_preseed boolean true/);
assert.match(preseed, /debconf\/priority select critical/);
assert.match(preseed, /netcfg\/enable boolean false/);
assert.match(preseed, /\/bin\/rinir-select-install-disk/);
assert.match(preseed, /partman\/confirm_nooverwrite boolean true/);
assert.match(preseed, /passwd\/root-login boolean true/);
assert.match(preseed, /passwd\/root-password-crypted password \*/);
assert.match(preseed, /passwd\/make-user boolean false/);
assert.match(preseed, /in-target passwd --lock root/);
assert.doesNotMatch(
    preseed,
    /pkgsel\/include/,
    "packages absent from Debian DVD-1 must be installed from the offline bundle"
);
assert.match(preseed, /grub-installer\/bootdev string default/);
assert.match(preseed, /touch \/target\/var\/lib\/rinir-factory\/install\.done/);
assert.ok(
    preseed.indexOf("install.done") > preseed.lastIndexOf("factory-provision.service"),
    "install.done must be created only after the first-boot service is installed"
);
assert.match(diskSelector, /install\.done/);
assert.match(diskSelector, /refusing to erase the internal disk/);
assert.match(diskSelector, /\/sys\/block\/\$block\/removable/);
assert.match(grubBoot, /set timeout=10/);
assert.match(grubBoot, /search --no-floppy --file[\s\S]*install\.done/);
assert.match(grubBoot, /configfile \/boot\/grub\/grub\.cfg/);
assert.match(grubBoot, /auto=true priority=critical/);
assert.match(grubBoot, /file=\/cdrom\/preseed\.cfg/);
assert.match(isolinuxBoot, /default rinir-auto/);
assert.match(isolinuxBoot, /timeout 100/);
assert.match(isolinuxBoot, /auto=true priority=critical/);
assert.match(isolinuxBoot, /file=\/cdrom\/preseed\.cfg/);
assert.match(isoBuildScript, /factory\/boot\/grub\.cfg[\s\S]*\/boot\/grub\/grub\.cfg/);
assert.match(isoBuildScript, /factory\/boot\/isolinux\.cfg[\s\S]*\/isolinux\/isolinux\.cfg/);
assert.match(isoBuildScript, /factory\/preseed\.cfg[\s\S]*\/preseed\.cfg/);
assert.match(isoBuildScript, /initrd-result\.gz[\s\S]*cpio -id --quiet preseed\.cfg[\s\S]*cmp .*preseed\.cfg/);
assert.match(isoBuildScript, /cmp .*grub-result\.cfg/);
assert.match(provisioning, /sha256sum --check SHA256SUMS/);
assert.match(provisioning, /packages\/Packages\.gz/);
assert.match(provisioning, /deb \[trusted=yes\] file:/);
assert.match(provisioning, /Dir::Etc::sourcelist=\$offline_sources/);
assert.match(provisioning, /Dir::Etc::sourceparts=-/);
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
assert.match(firewall, /iifname "rinir-mgmt" tcp dport 22 accept/);
assert.doesNotMatch(firewall, /rinir-modbus" tcp dport 443 accept/);
assert.doesNotMatch(firewall, /rinir-modbus" tcp dport 22 accept/);
assert.match(kiosk, /chromium --kiosk/);
assert.match(kiosk, /dashboard\/monitoring/);
assert.match(installer, /useradd --system[\s\S]*--shell \/bin\/bash rinir-kiosk/);
assert.doesNotMatch(installer, /--shell \/usr\/sbin\/nologin rinir-kiosk/);
assert.match(installer, /useradd --create-home --shell \/bin\/bash rinir/);
assert.match(installer, /usermod --append --groups sudo[\s\S]*rinir/);
assert.match(installer, /PermitRootLogin no/);
assert.match(installer, /AllowUsers rinir/);
assert.match(acceptance, /check_service ssh\.service/);

for (const name of [
    "MANAGEMENT_INTERFACE",
    "MODBUS_INTERFACE",
    "MODBUS_ADDRESS",
    "SALT_MASTER",
    "REMOTE_USER",
    "ADMIN_ACCESS_CODE",
    "NODE_RED_ADMIN_PASSWORD",
    "REMOTE_INITIAL_PASSWORD",
    "SSH_PASSWORD"
]) {
    assert.match(factoryExample, new RegExp(`^${name}=`, "m"));
    assert.ok(docs.includes(`\`${name}\``), `${name} must be documented`);
}

assert.match(installer, /admin_code="\$ADMIN_ACCESS_CODE"/);
assert.match(installer, /admin_password="\$NODE_RED_ADMIN_PASSWORD"/);
assert.match(installer, /remote_password="\$REMOTE_INITIAL_PASSWORD"/);
assert.match(bundle, /docker build[\s\S]*gas-monitoring-node-red:0\.1\.0/);
assert.match(bundle, /Dir::State::status=\/tmp\/rinir-empty-dpkg-status/);
assert.match(bundle, /dpkg-scanpackages/);
assert.match(bundle, /gzip -9 --keep Packages/);
for (const packageName of [
    "ca-certificates",
    "curl",
    "openssl",
    "apache2-utils",
    "nginx",
    "lightdm",
    "openbox",
    "chromium",
    "unclutter",
    "systemd-resolved",
    "nftables",
    "openssh-server",
    "sudo"
]) {
    assert.match(bundle, new RegExp(`\\b${packageName.replaceAll("-", "\\-")}\\b`));
}
assert.doesNotMatch(bundle, /compose\.production\.yaml[\s\S]*build node-red/);
assert.match(image, /tools\/wb-mai6-commission\.mjs/);
assert.match(image, /tools\/hardware-fat\.mjs/);
assert.match(installer, /gas-monitoring-acceptance\.service/);
assert.match(windowsBuilder, /Get-FileHash -Algorithm SHA256/);
assert.match(windowsBuilder, /Docker Desktop must use Linux amd64 containers/);
assert.match(windowsBuilder, /BUILD-INFO\.txt|Factory ISO created and verified/);
assert.match(windowsBuilder, /Output directory must be outside the repository/);
assert.match(windowsBuilder, /GitHub ZIP archives are not supported/);
assert.match(windowsBuilder, /New-Item -ItemType Directory -Path \$nodeModulesMountPoint/);
assert.match(isoBuilder, /xorriso/);
assert.match(isoBuilder, /docker:29\.6\.2-cli@sha256:/);
assert.match(windowsContainer, /tr -d '\\r'/);
assert.match(windowsContainer, /install -d -m 0700 \/work[\s\S]*tr -d '\\r'/);
assert.match(windowsContainer, /replace-with-/);
assert.match(windowsContainer, /ADMIN_ACCESS_CODE must contain at least 10 characters/);
assert.match(windowsContainer, /SSH_PASSWORD must contain at least 8 characters/);
assert.match(windowsContainer, /may contain only A-Z/);
assert.match(windowsBuilder, /Factory build evidence was not created/);
assert.doesNotMatch(windowsBuilder, /SourceSha256/);
assert.doesNotMatch(windowsContainer, /SOURCE_SHA256/);
assert.doesNotMatch(isoBuildScript, /SOURCE_SHA256/);

console.log("Factory installation, network, Salt independence and kiosk contracts passed");
