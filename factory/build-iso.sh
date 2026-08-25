#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_DIR
readonly SOURCE_ISO="${1:?usage: build-iso.sh SOURCE_DVD_ISO BUNDLE_DIR OUTPUT_ISO}"
readonly BUNDLE_DIR="${2:?usage: build-iso.sh SOURCE_DVD_ISO BUNDLE_DIR OUTPUT_ISO}"
readonly OUTPUT_ISO="${3:?usage: build-iso.sh SOURCE_DVD_ISO BUNDLE_DIR OUTPUT_ISO}"

# shellcheck disable=SC1091
source "$REPO_DIR/factory/versions.env"

command -v xorriso >/dev/null
command -v cpio >/dev/null
command -v gzip >/dev/null
command -v sha256sum >/dev/null

[[ -f "$SOURCE_ISO" ]] || {
  echo "Source ISO not found: $SOURCE_ISO" >&2
  exit 1
}
[[ -r "$BUNDLE_DIR/SHA256SUMS" ]] || {
  echo "Factory bundle is incomplete: $BUNDLE_DIR" >&2
  exit 1
}
(
  cd "$BUNDLE_DIR"
  sha256sum --check SHA256SUMS
)

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
install -d "$work_dir/initrd"

xorriso -osirrox on -indev "$SOURCE_ISO" \
  -extract /install.amd/initrd.gz "$work_dir/initrd-original.gz"
(
  cd "$work_dir/initrd"
  gzip -dc "$work_dir/initrd-original.gz" | cpio -id --quiet
  install -m 0644 "$REPO_DIR/factory/preseed.cfg" preseed.cfg
  install -m 0755 "$REPO_DIR/factory/select-install-disk.sh" \
    bin/rinir-select-install-disk
  find . -print0 |
    cpio --null --create --format=newc --quiet |
    gzip -9 >"$work_dir/initrd-rinir.gz"
)

rm -f "$OUTPUT_ISO"
xorriso \
  -indev "$SOURCE_ISO" \
  -outdev "$OUTPUT_ISO" \
  -boot_image any replay \
  -map "$work_dir/initrd-rinir.gz" /install.amd/initrd.gz \
  -map "$REPO_DIR/factory/preseed.cfg" /preseed.cfg \
  -map "$REPO_DIR/factory/boot/grub.cfg" /boot/grub/grub.cfg \
  -map "$REPO_DIR/factory/boot/isolinux.cfg" /isolinux/isolinux.cfg \
  -map "$BUNDLE_DIR" /factory \
  -commit

xorriso -osirrox on -indev "$OUTPUT_ISO" \
  -extract /preseed.cfg "$work_dir/preseed-result.cfg" \
  -extract /install.amd/initrd.gz "$work_dir/initrd-result.gz" \
  -extract /boot/grub/grub.cfg "$work_dir/grub-result.cfg" \
  -extract /isolinux/isolinux.cfg "$work_dir/isolinux-result.cfg"
cmp "$REPO_DIR/factory/preseed.cfg" "$work_dir/preseed-result.cfg"
cmp "$REPO_DIR/factory/boot/grub.cfg" "$work_dir/grub-result.cfg"
cmp "$REPO_DIR/factory/boot/isolinux.cfg" "$work_dir/isolinux-result.cfg"
install -d "$work_dir/initrd-result"
(
  cd "$work_dir/initrd-result"
  gzip -dc "$work_dir/initrd-result.gz" | cpio -id --quiet preseed.cfg
  cmp "$REPO_DIR/factory/preseed.cfg" preseed.cfg
)
sha256sum "$OUTPUT_ISO" >"$OUTPUT_ISO.sha256"
echo "Autonomous installer ISO created: $OUTPUT_ISO"
