#!/usr/bin/env bash
set -euo pipefail

host="${WB_HOST:-192.168.50.10}"
unit="${WB_UNIT_ID:-65}"
mode="${1:---read-only}"
evidence_dir="${WB_EVIDENCE_DIR:-./commissioning-evidence}"

if ! command -v mbpoll >/dev/null 2>&1; then
  echo "mbpoll is required" >&2
  exit 1
fi

if [[ "$mode" != "--read-only" && "$mode" != "--apply" ]]; then
  echo "Usage: $0 [--read-only|--apply]" >&2
  exit 2
fi

mkdir -p "$evidence_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$evidence_dir/wb-mai6-${host}-${unit}-${stamp}.log"

channels=(
  "IN1P/O2:5120:5128:5130:5380"
  "IN2P/AIR:9216:9224:9226:9476"
  "IN3P/N2O:13312:13320:13322:13572"
)

read_register() {
  local register="$1" table="$2"
  mbpoll -m tcp -a "$unit" -0 -r "$register" -c 1 -t "$table" -o 3 -1 "$host"
}

write_register() {
  local register="$1" value="$2"
  mbpoll -m tcp -a "$unit" -0 -r "$register" -t 4 -o 3 -1 "$host" "$value"
}

snapshot() {
  local phase="$1"
  echo "=== $phase $(date -u +%FT%TZ) host=$host unit=$unit ==="
  for item in "${channels[@]}"; do
    IFS=: read -r name type_register low_register high_register value_register <<<"$item"
    echo "--- $name ---"
    read_register "$type_register" 4
    read_register "$low_register" 4
    read_register "$high_register" 4
    read_register "$value_register" 3
  done
}

snapshot "before" | tee "$evidence"

if [[ "$mode" == "--read-only" ]]; then
  echo "Read-only inspection complete: $evidence"
  exit 0
fi

echo "This writes nine WB-MAI6 holding registers at $host, unit $unit."
read -r -p "Type APPLY to continue: " confirmation
if [[ "$confirmation" != "APPLY" ]]; then
  echo "Cancelled; no registers were written."
  exit 3
fi

for item in "${channels[@]}"; do
  IFS=: read -r _ type_register low_register high_register _ <<<"$item"
  write_register "$type_register" 4866
  write_register "$low_register" 0
  write_register "$high_register" 160
done

snapshot "after" | tee -a "$evidence"
echo "Configuration written and read back. Verify type=4866, low=0, high=160 in $evidence."
