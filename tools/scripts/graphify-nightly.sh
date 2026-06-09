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
skip_dirs = {'.git', 'node_modules', '.next', 'dist', 'build', '.venv', 'venv', '__pycache__', 'graphify-out'}
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
  # Preferences: claude-bedrock first (Graphify bedrock backend), then ollama-m4pro,
  # then ollama-m1 as final fallback. "openai" is NOT a registered provider — excluded.
  # codex-cli is excluded: no Graphify CLI backend integration.
  printf '{"task_type":%s,"input_token_count":%s,"urgent":true,"task_metadata":{"quality_tier":"highest","preferred_providers":["claude-bedrock","ollama-m4pro","ollama-m1"],"preferred_models":["us.anthropic.claude-opus-4-6-v1"],"fallback_policy":"ordered_then_selector_default"}}' \
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
provider_id = data.get("provider_id", "")
provider_type = data.get("provider_type", "")
model = data.get("model", "")
base_url = data.get("base_url", "")
api_key = data.get("api_key")
if not provider_id or not model:
    raise SystemExit(1)
parsed = urlparse(base_url)
host = f"{parsed.scheme or 'http'}://{parsed.netloc}" if parsed.netloc else ""
print(json.dumps({
    "provider_id": provider_id,
    "provider_type": provider_type,
    "model": model,
    "base_url": base_url,
    "api_key": api_key,
    "ollama_host": host
}))
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
  local env_vars="$2"
  shift 2
  python3 - "$REPO_TIMEOUT_SECONDS" "$repo" "$env_vars" "$@" <<'PY'
import os
import subprocess
import sys
import json

timeout = int(sys.argv[1])
repo = sys.argv[2]
env_vars_json = sys.argv[3]
cmd = sys.argv[4:]
env = os.environ.copy()

# Merge custom environment variables
if env_vars_json:
    try:
        custom_env = json.loads(env_vars_json)
        env.update(custom_env)
    except (json.JSONDecodeError, TypeError):
        pass

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

  graph_json="$repo/graphify-out/graph.json"

  if [[ -f "$graph_json" ]]; then
    # Update path: always call selector before graphify update (no bypass).
    if (( safe_model_unavailable == 1 )); then
      log "skipping repo=$repo reason=no_safe_local_model_cached phase=update"
      skipped=$((skipped + 1))
      continue
    fi

    tokens="$(estimate_tokens "$repo")"
    log "selecting model repo=$repo task=$TASK_TYPE tokens=$tokens phase=update"
    if ! selection="$(select_graphify_model "$tokens")"; then
      safe_model_unavailable=1
      skipped=$((skipped + 1))
      log "skipping repo=$repo reason=no_safe_local_model phase=update"
      continue
    fi

    provider_id="$(selection_value "$selection" provider_id)"
    provider_type="$(selection_value "$selection" provider_type)"
    model="$(selection_value "$selection" model)"
    base_url="$(selection_value "$selection" base_url)"
    api_key="$(selection_value "$selection" api_key)"
    log "extracting repo=$repo provider=$provider_id provider_type=$provider_type model=$model phase=update"

    # graphify update is AST-only (no LLM needed) — no --backend args required.
    # The selector was called only to gate whether a safe local model is available.
    backend_args=""
    env_vars="{}"

    log "updating repo=$repo"
    if run_repo_command "$repo" "$env_vars" "$GRAPHIFY_BIN" update "$repo" $backend_args; then
      updates=$((updates + 1))
      report_selector_outcome report-success "$provider_id" "$model"
      log "updated repo=$repo provider=$provider_id model=$model"
    else
      rc="$?"
      failed=$((failed + 1))
      report_selector_outcome report-failure "$provider_id" "$model" "graphify_failed" "graphify update exited $rc"
      log "failed repo=$repo phase=update exit_code=$rc provider=$provider_id model=$model"
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

  provider_id="$(selection_value "$selection" provider_id)"
  provider_type="$(selection_value "$selection" provider_type)"
  model="$(selection_value "$selection" model)"
  base_url="$(selection_value "$selection" base_url)"
  api_key="$(selection_value "$selection" api_key)"
  ollama_host="$(selection_value "$selection" ollama_host)"
  log "extracting repo=$repo provider=$provider_id provider_type=$provider_type model=$model"

  # Build backend-specific arguments for graphify extract.
  # Valid --backend values: gemini|kimi|claude|openai|deepseek|ollama|bedrock
  # Registered providers: claude-bedrock → bedrock; ollama-m4pro / ollama-m1 → ollama
  # "openai-compatible" is a provider_type, not a Graphify backend name — use "ollama" instead.
  backend_args=""
  env_vars="{}"

  if [[ "$provider_type" == "bedrock" ]] || [[ "$provider_id" == "claude-bedrock" ]]; then
    # Bedrock: no --model (selector returns portfolio alias, not a concrete model ID).
    # Auth via AWS_PROFILE / AWS_REGION in the ambient environment.
    backend_args="--backend bedrock"
  elif [[ "$provider_type" == "openai-compatible" ]] || [[ "$provider_id" == "ollama-m4pro" ]] || [[ "$provider_id" == "ollama-m1" ]]; then
    # Ollama: use OLLAMA_BASE_URL env var (Graphify reads this, not --api-base).
    ollama_host_url="${base_url:-http://localhost:11434}"
    backend_args="--backend ollama --model $model"
    env_vars="{\"OLLAMA_BASE_URL\": \"$ollama_host_url\"}"
  fi

  if run_repo_command "$repo" "$env_vars" "$GRAPHIFY_BIN" extract "$repo" $backend_args --out "$repo"; then
    first_builds=$((first_builds + 1))
    report_selector_outcome report-success "$provider_id" "$model"
    # Clean up Ollama models after use
    if [[ "$provider_type" == "openai-compatible" ]] || [[ "$provider_id" == "ollama-m4pro" ]] || [[ "$provider_id" == "ollama-m1" ]]; then
      unload_ollama_model "$model"
    fi
    log "extracted repo=$repo provider=$provider_id model=$model"
  else
    rc="$?"
    failed=$((failed + 1))
    report_selector_outcome report-failure "$provider_id" "$model" "graphify_failed" "graphify extract exited $rc"
    if [[ "$provider_type" == "openai-compatible" ]] || [[ "$provider_id" == "ollama-m4pro" ]] || [[ "$provider_id" == "ollama-m1" ]]; then
      unload_ollama_model "$model"
    fi
    log "failed repo=$repo phase=extract exit_code=$rc provider=$provider_id model=$model"
  fi
done < <(discover_repos)

log "graphify-nightly summary first_builds=$first_builds updates=$updates skipped=$skipped failed=$failed"

if (( failed > 0 )); then
  exit 1
fi
