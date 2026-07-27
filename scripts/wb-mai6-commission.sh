#!/usr/bin/env bash
set -euo pipefail

host="${WB_HOST:-192.168.50.10}"
unit="${WB_UNIT_ID:-65}"
mode="${1:---read-only}"
evidence_dir="${WB_EVIDENCE_DIR:-./commissioning-evidence}"
input_list="${WB_INPUTS:-IN1P,IN2P,IN3P}"
sensor_type="${WB_SENSOR_TYPE:-4866}"
scale_low="${WB_SCALE_LOW:-0}"
scale_high="${WB_SCALE_HIGH:-160}"

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

IFS=, read -r -a selected_inputs <<<"$input_list"

registers_for_input() {
  local input="${1^^}"
  if [[ ! "$input" =~ ^IN([1-6])([PN])$ ]]; then
    echo "Unsupported WB-MAI6 input: $input" >&2
    exit 4
  fi
  local channel="${BASH_REMATCH[1]}"
  local side="${BASH_REMATCH[2]}"
  local offset=0
  [[ "$side" == "N" ]] && offset=1
  local base=$((4096 * channel))
  printf '%s:%d:%d:%d:%d\n' \
    "$input" \
    $((base + 1024 + offset)) \
    $((base + 1032 + offset)) \
    $((base + 1034 + offset)) \
    $((base + 1284 + offset))
}

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
  for input in "${selected_inputs[@]}"; do
    item="$(registers_for_input "$input")"
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

echo "This writes three holding registers for each selected input ($input_list) at $host, unit $unit."
read -r -p "Type APPLY to continue: " confirmation
if [[ "$confirmation" != "APPLY" ]]; then
  echo "Cancelled; no registers were written."
  exit 3
fi

for input in "${selected_inputs[@]}"; do
  item="$(registers_for_input "$input")"
  IFS=: read -r _ type_register low_register high_register _ <<<"$item"
  write_register "$type_register" "$sensor_type"
  write_register "$low_register" "$scale_low"
  write_register "$high_register" "$scale_high"
done

snapshot "after" | tee -a "$evidence"
echo "Configuration written and read back. Verify type=$sensor_type, low=$scale_low, high=$scale_high in $evidence."
