#!/bin/sh
set -eu

scan_dir=/tmp/rinir-installed-system
mkdir -p "$scan_dir"

for partition in $(list-devices partition); do
  if mount -o ro "$partition" "$scan_dir" 2>/dev/null; then
    if [ -e "$scan_dir/var/lib/rinir-factory/install.done" ]; then
      umount "$scan_dir"
      echo "RINIR is already installed; refusing to erase the internal disk" >/dev/tty1
      sleep 10
      poweroff -f
      exit 1
    fi
    umount "$scan_dir"
  fi
done

install_disk=""
for candidate in $(list-devices disk); do
  block="${candidate#/dev/}"
  [ -r "/sys/block/$block/removable" ] || continue
  [ "$(cat "/sys/block/$block/removable")" = "0" ] || continue
  install_disk="$candidate"
  break
done

if [ -z "$install_disk" ]; then
  echo "No non-removable internal installation disk found" >/dev/tty1
  exit 1
fi

debconf-set partman-auto/disk "$install_disk"
