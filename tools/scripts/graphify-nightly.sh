#!/usr/bin/env bash
set -euo pipefail

REPO_ROOTS="${GRAPHIFY_REPO_ROOTS:-/Users/Office/Repos}"
REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-7200}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-graphify}"
GRAPHIFY_BACKEND="${GRAPHIFY_BACKEND:-ollama}"
GRAPHIFY_MODEL="${GRAPHIFY_MODEL:-gemma4:12b}"
GRAPHIFY_TOKEN_BUDGET="${GRAPHIFY_TOKEN_BUDGET:-4000}"
OLLAMA_API_KEY="${OLLAMA_API_KEY:-ollama}"
GRAPHIFY_OLLAMA_NUM_CTX="${GRAPHIFY_OLLAMA_NUM_CTX:-8192}"
GRAPHIFY_OLLAMA_KEEP_ALIVE="${GRAPHIFY_OLLAMA_KEEP_ALIVE:-30}"
GRAPHIFY_MAX_CONCURRENCY="${GRAPHIFY_MAX_CONCURRENCY:-1}"
GRAPHIFY_API_TIMEOUT="${GRAPHIFY_API_TIMEOUT:-900}"
GRAPHIFY_NO_VIZ="${GRAPHIFY_NO_VIZ:-1}"
SCHEDULER_CUTOFF_HOUR="${SCHEDULER_CUTOFF_HOUR:-7}"

timestamp() {
  TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

check_scheduler_cutoff() {
  local hour_lisbon
  hour_lisbon="$(TZ=Europe/Lisbon date +%H)"
  if (( 10#$hour_lisbon >= SCHEDULER_CUTOFF_HOUR )); then
    log "reached ${SCHEDULER_CUTOFF_HOUR}:00 cutoff, not starting new repos"
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

build_graphify_cmd() {
  local repo="$1"
  local -a cmd=(
    "$GRAPHIFY_BIN" extract "$repo"
    --backend "$GRAPHIFY_BACKEND"
    --token-budget "$GRAPHIFY_TOKEN_BUDGET"
    --max-concurrency "$GRAPHIFY_MAX_CONCURRENCY"
    --api-timeout "$GRAPHIFY_API_TIMEOUT"
  )
  if [[ "${GRAPHIFY_NO_VIZ:-0}" == "1" ]]; then
    cmd+=(--no-viz)
  fi
  printf '%s\n' "${cmd[@]}"
}

run_graphify() {
  local repo="$1"
  shift
  OLLAMA_API_KEY="$OLLAMA_API_KEY" \
  OLLAMA_MODEL="$GRAPHIFY_MODEL" \
  GRAPHIFY_OLLAMA_NUM_CTX="$GRAPHIFY_OLLAMA_NUM_CTX" \
  GRAPHIFY_OLLAMA_KEEP_ALIVE="$GRAPHIFY_OLLAMA_KEEP_ALIVE" \
  python3 - "$REPO_TIMEOUT_SECONDS" "$repo" "$@" <<'PY'
import os
import subprocess
import sys

timeout = int(sys.argv[1])
repo = sys.argv[2]
cmd = sys.argv[3:]
try:
    os.nice(15)
except OSError:
    pass
result = subprocess.run(cmd, cwd=repo, timeout=timeout)
raise SystemExit(result.returncode)
PY
}

log_outputs() {
  local repo="$1"
  local -a outputs=("graphify-out/graph.json" "graphify-out/graph.html" "graphify-out/GRAPH_REPORT.md")
  for out in "${outputs[@]}"; do
    if [[ -f "$repo/$out" ]]; then
      log "  [ok] $out"
    else
      log "  [missing] $out"
    fi
  done
}

if ! command -v "$GRAPHIFY_BIN" >/dev/null 2>&1; then
  log "graphify unavailable path=$GRAPHIFY_BIN"
  exit 1
fi

if [[ "$GRAPHIFY_BACKEND" != "ollama" ]]; then
  log "refusing non-local backend=$GRAPHIFY_BACKEND — Graphify is local-only and must use Ollama"
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  log "ollama unavailable — Graphify requires a running Ollama instance"
  exit 1
fi

log "graphify-nightly start backend=$GRAPHIFY_BACKEND model=$GRAPHIFY_MODEL token-budget=$GRAPHIFY_TOKEN_BUDGET max-concurrency=$GRAPHIFY_MAX_CONCURRENCY api-timeout=$GRAPHIFY_API_TIMEOUT no-viz=$GRAPHIFY_NO_VIZ"

first_builds=0
updates=0
skipped=0
failed=0

while IFS= read -r repo; do
  [[ -n "$repo" ]] || continue

  if ! check_scheduler_cutoff; then
    log "skipping repo=$repo reason=scheduler_cutoff"
    skipped=$((skipped + 1))
    continue
  fi

  graph_json="$repo/graphify-out/graph.json"
  start_ts="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"

  # Build the command array from current settings
  readarray -t graphify_cmd < <(build_graphify_cmd "$repo")

  if [[ -f "$graph_json" ]]; then
    log "updating repo=$repo backend=$GRAPHIFY_BACKEND model=$GRAPHIFY_MODEL token-budget=$GRAPHIFY_TOKEN_BUDGET concurrency=$GRAPHIFY_MAX_CONCURRENCY timeout=$GRAPHIFY_API_TIMEOUT graph_json=exists"
    if run_graphify "$repo" "${graphify_cmd[@]}"; then
      end_ts="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
      updates=$((updates + 1))
      log "updated repo=$repo started=$start_ts ended=$end_ts exit=0"
      log_outputs "$repo"
    else
      rc="$?"
      end_ts="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
      failed=$((failed + 1))
      log "failed repo=$repo phase=update started=$start_ts ended=$end_ts exit=$rc"
    fi
    continue
  fi

  log "first-build repo=$repo backend=$GRAPHIFY_BACKEND model=$GRAPHIFY_MODEL token-budget=$GRAPHIFY_TOKEN_BUDGET concurrency=$GRAPHIFY_MAX_CONCURRENCY timeout=$GRAPHIFY_API_TIMEOUT graph_json=missing"
  if run_graphify "$repo" "${graphify_cmd[@]}"; then
    end_ts="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
    first_builds=$((first_builds + 1))
    log "extracted repo=$repo started=$start_ts ended=$end_ts exit=0"
    log_outputs "$repo"
  else
    rc="$?"
    end_ts="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
    failed=$((failed + 1))
    log "failed repo=$repo phase=first-build started=$start_ts ended=$end_ts exit=$rc"
  fi
done < <(discover_repos)

log "graphify-nightly summary first_builds=$first_builds updates=$updates skipped=$skipped failed=$failed"

if (( failed > 0 )); then
  exit 1
fi
