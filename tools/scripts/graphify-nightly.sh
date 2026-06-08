#!/usr/bin/env bash
set -euo pipefail

REPO_ROOTS="${GRAPHIFY_REPO_ROOTS:-/Users/Office/Repos}"
STATE_DIR="${GRAPHIFY_STATE_DIR:-$HOME/.local/state/office-scheduler/graphify-nightly}"
SELECTOR_URL="${AI_SELECTOR_URL:-http://127.0.0.1:4890}"
TASK_TYPE="${GRAPHIFY_SELECTOR_TASK_TYPE:-codebase_semantic_graph}"
REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-7200}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-graphify}"
SCHEDULER_CUTOFF_HOUR="${GRAPHIFY_SCHEDULER_CUTOFF_HOUR:-7}"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

timestamp() {
  TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

estimate_tokens() {
  local repo="$1"
  python3 - "$repo" <<'PY'
import os
import sys
from pathlib import Path

root = Path(sys.argv[1])
skip_dirs = {'.git', 'node_modules', '.next', 'dist', 'build', '.venv', 'venv', '__pycache__', 'graphify-out', '.graphify-out'}
extensions = {
    '.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.rs', '.java', '.kt',
    '.swift', '.md', '.mdx', '.json', '.yaml', '.yml', '.toml', '.sh', '.sql'
}
bytes_seen = 0
files_seen = 0
for current, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.cache')]
    for name in files:
        path = Path(current) / name
        if path.suffix.lower() not in extensions:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > 1_000_000:
            continue
        bytes_seen += size
        files_seen += 1
print(max(1000, min(120000, bytes_seen // 4)))
PY
}

selector_payload() {
  local tokens="$1"
  printf '{"task_type":%s,"input_token_count":%s,"urgent":true,"local_only":true}' \
    "$(json_escape "$TASK_TYPE")" \
    "$tokens"
}

select_graphify_model() {
  local tokens="$1"
  local response
  response="$(curl -fs --max-time 20 \
    -H 'Content-Type: application/json' \
    -d "$(selector_payload "$tokens")" \
    "$SELECTOR_URL/select")" || return 1

  python3 - "$response" <<'PY'
import json
import sys
from urllib.parse import urlparse

data = json.loads(sys.argv[1])
if data.get("deferred"):
    raise SystemExit(2)
provider = data.get("provider_id", "")
model = data.get("model", "")
base_url = data.get("base_url", "")
if not provider or not model:
    raise SystemExit(1)
parsed = urlparse(base_url)
host = f"{parsed.scheme or 'http'}://{parsed.netloc}" if parsed.netloc else ""
print(json.dumps({"provider_id": provider, "model": model, "ollama_host": host}))
PY
}

selection_value() {
  local selection="$1"
  local key="$2"
  python3 - "$selection" "$key" <<'PY'
import json
import sys
data = json.loads(sys.argv[1])
print(data.get(sys.argv[2], ""))
PY
}

report_selector_outcome() {
  local endpoint="$1"
  local provider="$2"
  local model="$3"
  local error_type="${4:-}"
  local error_message="${5:-}"
  python3 - "$SELECTOR_URL" "$endpoint" "$provider" "$model" "$error_type" "$error_message" <<'PY' || true
import json
import sys
import urllib.request

base, endpoint, provider, model, error_type, error_message = sys.argv[1:7]
payload = {"provider_id": provider, "model": model}
if error_type:
    payload["error_type"] = error_type
if error_message:
    payload["error_message"] = error_message[:500]
request = urllib.request.Request(
    f"{base.rstrip('/')}/{endpoint.lstrip('/')}",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
urllib.request.urlopen(request, timeout=10).read()
PY
}

unload_ollama_model() {
  local model="$1"
  if [[ -z "$model" ]] || ! command -v ollama >/dev/null 2>&1; then
    return 0
  fi
  ollama stop "$model" >/dev/null 2>&1 || true
}

run_repo_command() {
  local repo="$1"
  shift
  python3 - "$REPO_TIMEOUT_SECONDS" "$repo" "$@" <<'PY'
import os
import subprocess
import sys

timeout = int(sys.argv[1])
repo = sys.argv[2]
cmd = sys.argv[3:]
env = os.environ.copy()
try:
    os.nice(15)
except OSError:
    pass
result = subprocess.run(cmd, cwd=repo, env=env, timeout=timeout)
raise SystemExit(result.returncode)
PY
}

check_scheduler_cutoff() {
  local hour_lisbon
  hour_lisbon="$(TZ=Europe/Lisbon date +%H)"
  if (( 10#$hour_lisbon >= SCHEDULER_CUTOFF_HOUR )); then
    log "reached $SCHEDULER_CUTOFF_HOUR:00 cutoff, not starting new repos"
    return 1
  fi
  return 0
}

discover_repos() {
  local root
  for root in $REPO_ROOTS; do
    if [[ -d "$root" ]]; then
      find "$root" -maxdepth 3 -name .git -type d 2>/dev/null | sed 's#/.git$##'
    fi
  done | sort -u
}

if ! command -v "$GRAPHIFY_BIN" >/dev/null 2>&1; then
  log "graphify unavailable path=$GRAPHIFY_BIN"
  exit 1
fi

first_builds=0
updates=0
skipped=0
failed=0
safe_model_unavailable=0

while IFS= read -r repo; do
  [[ -n "$repo" ]] || continue

  # Time boundary check: stop starting new repos after cutoff hour, but finish in-progress tasks
  if ! check_scheduler_cutoff; then
    log "skipping repo=$repo reason=scheduler_cutoff"
    skipped=$((skipped + 1))
    continue
  fi

  graph_json="$repo/.graphify-out/graph.json"
  if [[ ! -f "$graph_json" ]]; then
    graph_json="$repo/graphify-out/graph.json"
  fi

  if [[ -f "$graph_json" ]]; then
    log "updating repo=$repo"
    if run_repo_command "$repo" "$GRAPHIFY_BIN" update "$repo"; then
      updates=$((updates + 1))
      log "updated repo=$repo"
    else
      failed=$((failed + 1))
      log "failed repo=$repo phase=update"
    fi
    continue
  fi

  if (( safe_model_unavailable == 1 )); then
    log "skipping repo=$repo reason=no_safe_local_model_cached"
    skipped=$((skipped + 1))
    continue
  fi

  tokens="$(estimate_tokens "$repo")"
  log "selecting model repo=$repo task=$TASK_TYPE tokens=$tokens"
  if ! selection="$(select_graphify_model "$tokens")"; then
    safe_model_unavailable=1
    skipped=$((skipped + 1))
    log "skipping repo=$repo reason=no_safe_local_model"
    continue
  fi

  provider="$(selection_value "$selection" provider_id)"
  model="$(selection_value "$selection" model)"
  ollama_host="$(selection_value "$selection" ollama_host)"
  log "extracting repo=$repo provider=$provider model=$model"

  if [[ -n "$ollama_host" ]]; then
    export OLLAMA_HOST="$ollama_host"
  else
    unset OLLAMA_HOST
  fi
  if run_repo_command "$repo" "$GRAPHIFY_BIN" extract "$repo" --backend ollama --model "$model" --out "$repo"; then
    first_builds=$((first_builds + 1))
    report_selector_outcome report-success "$provider" "$model"
    unload_ollama_model "$model"
    log "extracted repo=$repo provider=$provider model=$model"
  else
    rc="$?"
    failed=$((failed + 1))
    report_selector_outcome report-failure "$provider" "$model" "graphify_failed" "graphify extract exited $rc"
    unload_ollama_model "$model"
    log "failed repo=$repo phase=extract exit_code=$rc provider=$provider model=$model"
  fi
done < <(discover_repos)

log "graphify-nightly summary first_builds=$first_builds updates=$updates skipped=$skipped failed=$failed"

if (( failed > 0 )); then
  exit 1
fi
