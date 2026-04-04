#!/usr/bin/env bash
set -euo pipefail

AZ="${AZURE_CLI_BIN:-$HOME/.local/bin/azure-cli}"

if ! command -v "$AZ" >/dev/null 2>&1; then
  echo "Azure CLI not found at $AZ" >&2
  exit 1
fi

subs_json="$("$AZ" account list --all --output json)"

if [[ "$subs_json" == "[]" ]]; then
  echo '{"subscriptions":[],"resourceGroups":[],"resources":[]}'
  exit 0
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

printf '%s' "$subs_json" > "$tmpdir/subscriptions.json"

python3 - <<'PY' "$tmpdir/subscriptions.json" > "$tmpdir/sub_ids.txt"
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for sub in data:
    sid = sub.get("id")
    if sid:
        print(sid)
PY

printf '[' > "$tmpdir/resource_groups.json"
first=1
while IFS= read -r sid; do
  [[ -z "$sid" ]] && continue
  out="$("$AZ" group list --subscription "$sid" --output json 2>/dev/null || echo '[]')"
  if [[ $first -eq 0 ]]; then printf ',' >> "$tmpdir/resource_groups.json"; fi
  printf '%s' "$out" >> "$tmpdir/resource_groups.json"
  first=0
done < "$tmpdir/sub_ids.txt"
printf ']' >> "$tmpdir/resource_groups.json"

printf '[' > "$tmpdir/resources.json"
first=1
while IFS= read -r sid; do
  [[ -z "$sid" ]] && continue
  out="$("$AZ" resource list --subscription "$sid" --output json 2>/dev/null || echo '[]')"
  if [[ $first -eq 0 ]]; then printf ',' >> "$tmpdir/resources.json"; fi
  printf '%s' "$out" >> "$tmpdir/resources.json"
  first=0
done < "$tmpdir/sub_ids.txt"
printf ']' >> "$tmpdir/resources.json"

python3 - <<'PY' "$tmpdir/subscriptions.json" "$tmpdir/resource_groups.json" "$tmpdir/resources.json"
import json, sys
with open(sys.argv[1]) as f:
    subs = json.load(f)
with open(sys.argv[2]) as f:
    group_batches = json.load(f)
with open(sys.argv[3]) as f:
    resource_batches = json.load(f)

groups = [item for batch in group_batches for item in batch]
resources = [item for batch in resource_batches for item in batch]

print(json.dumps({
    "subscriptions": subs,
    "resourceGroups": groups,
    "resources": resources,
}, indent=2))
PY
