#!/usr/bin/env bash
set -euo pipefail

SSH_TARGET="${N8N_SSH_TARGET:-dokploy}"
BACKUP_ROOT="${N8N_BACKUP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/operations/automations/n8n/n8n_backup}"
TIMESTAMP="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

strip_to_json() {
  awk 'found || /^[[:space:]]*[\[\{]/ { found = 1; print }'
}

find_n8n_container() {
  ssh "$SSH_TARGET" "docker ps --format '{{.Names}} {{.Image}}' | awk '/n8nio\\/n8n:/ {print \$1; exit}'"
}

CONTAINER="${N8N_DOCKER_CONTAINER:-$(find_n8n_container)}"

if [[ -z "$CONTAINER" ]]; then
  echo "No running n8n container found on $SSH_TARGET" >&2
  exit 1
fi

OUT_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

ssh "$SSH_TARGET" "docker exec -u node $CONTAINER n8n export:credentials --all --decrypted --pretty" | strip_to_json > "$OUT_DIR/credentials.decrypted.json"
ssh "$SSH_TARGET" "docker exec -u node $CONTAINER n8n export:credentials --all --pretty" | strip_to_json > "$OUT_DIR/credentials.encrypted.json"
ssh "$SSH_TARGET" "docker exec -u node $CONTAINER n8n export:workflow --all --pretty" | strip_to_json > "$OUT_DIR/workflows.json"

cat > "$OUT_DIR/metadata.json" <<EOF
{
  "created_at_utc": "$TIMESTAMP",
  "ssh_target": "$SSH_TARGET",
  "container": "$CONTAINER",
  "files": [
    "credentials.decrypted.json",
    "credentials.encrypted.json",
    "workflows.json"
  ]
}
EOF

chmod 600 "$OUT_DIR/credentials.decrypted.json" "$OUT_DIR/credentials.encrypted.json" "$OUT_DIR/workflows.json" "$OUT_DIR/metadata.json"

ln -sfn "$OUT_DIR" "$BACKUP_ROOT/latest"

printf 'backup_dir=%s\n' "$OUT_DIR"
