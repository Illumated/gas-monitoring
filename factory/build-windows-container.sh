#!/usr/bin/env bash
set -euo pipefail

readonly REPO_DIR=/repo
readonly SOURCE_ISO=/input/debian.iso
readonly FACTORY_CONFIG=/input/factory.env
readonly OUTPUT_DIR=/output
readonly BUNDLE_DIR=/work/factory
readonly NORMALIZED_FACTORY_CONFIG=/work/factory.env

[[ "$(uname -m)" == "x86_64" ]] || {
  echo "Windows factory builder requires linux/amd64 Docker containers" >&2
  exit 1
}
[[ -S /var/run/docker.sock ]] || {
  echo "Docker socket is not available inside the factory builder" >&2
  exit 1
}
[[ -r "$SOURCE_ISO" ]] || {
  echo "Debian source ISO is not mounted" >&2
  exit 1
}
[[ -r "$FACTORY_CONFIG" ]] || {
  echo "Factory config is not mounted" >&2
  exit 1
}

install -d -m 0700 /work
git config --global --add safe.directory "$REPO_DIR"
[[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]] || {
  echo "Refusing to build from a dirty Git worktree" >&2
  exit 1
}

tr -d '\r' <"$FACTORY_CONFIG" >"$NORMALIZED_FACTORY_CONFIG"
chmod 0600 "$NORMALIZED_FACTORY_CONFIG"
if grep -q 'replace-with-' "$NORMALIZED_FACTORY_CONFIG"; then
  echo "Factory config contains unchanged placeholder credentials" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$NORMALIZED_FACTORY_CONFIG"
: "${ADMIN_ACCESS_CODE:=}"
: "${NODE_RED_ADMIN_PASSWORD:=}"
: "${REMOTE_INITIAL_PASSWORD:=}"
[[ ${#ADMIN_ACCESS_CODE} -ge 10 ]] || {
  echo "ADMIN_ACCESS_CODE must contain at least 10 characters" >&2
  exit 1
}
[[ ${#NODE_RED_ADMIN_PASSWORD} -ge 12 ]] || {
  echo "NODE_RED_ADMIN_PASSWORD must contain at least 12 characters" >&2
  exit 1
}
[[ ${#REMOTE_INITIAL_PASSWORD} -ge 10 ]] || {
  echo "REMOTE_INITIAL_PASSWORD must contain at least 10 characters" >&2
  exit 1
}
for secret_name in ADMIN_ACCESS_CODE NODE_RED_ADMIN_PASSWORD REMOTE_INITIAL_PASSWORD; do
  secret_value="${!secret_name}"
  [[ "$secret_value" =~ ^[A-Za-z0-9._@+-]+$ ]] || {
    echo "$secret_name may contain only A-Z, a-z, 0-9 and ._@+-" >&2
    exit 1
  }
done

npm --prefix "$REPO_DIR" ci --cache /npm-cache --no-audit --no-fund
rm -rf "$BUNDLE_DIR"
bash "$REPO_DIR/factory/build-bundle.sh" "$BUNDLE_DIR" "$NORMALIZED_FACTORY_CONFIG"

# shellcheck disable=SC1091
source "$REPO_DIR/factory/versions.env"
readonly OUTPUT_ISO="$OUTPUT_DIR/RINIR-${DEBIAN_RELEASE}-amd64.iso"
bash "$REPO_DIR/factory/build-iso.sh" \
  "$SOURCE_ISO" \
  "$BUNDLE_DIR" \
  "$OUTPUT_ISO"

sha256sum --check "$OUTPUT_ISO.sha256"
xorriso -indev "$OUTPUT_ISO" -report_el_torito plain -report_system_area plain
printf '%s\n' "Git commit: $(git -C "$REPO_DIR" rev-parse HEAD)" \
  >"$OUTPUT_DIR/BUILD-INFO.txt"
printf '%s\n' "Factory ISO: $(basename "$OUTPUT_ISO")" \
  >>"$OUTPUT_DIR/BUILD-INFO.txt"
printf '%s\n' "SHA-256: $(cut -d' ' -f1 "$OUTPUT_ISO.sha256")" \
  >>"$OUTPUT_DIR/BUILD-INFO.txt"

echo "Windows factory build completed: $OUTPUT_ISO"
