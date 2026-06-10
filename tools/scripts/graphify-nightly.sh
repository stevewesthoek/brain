#!/usr/bin/env bash
set -euo pipefail

REPO_ROOTS="${GRAPHIFY_REPO_ROOTS:-/Users/Office/Repos}"
REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-7200}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-graphify}"
GRAPHIFY_BACKEND="${GRAPHIFY_BACKEND:-ollama}"
GRAPHIFY_MODEL="${GRAPHIFY_MODEL:-gemma4:12b-mlx}"
OLLAMA_API_KEY="${OLLAMA_API_KEY:-ollama}"
GRAPHIFY_OLLAMA_NUM_CTX="${GRAPHIFY_OLLAMA_NUM_CTX:-8192}"
GRAPHIFY_OLLAMA_KEEP_ALIVE="${GRAPHIFY_OLLAMA_KEEP_ALIVE:-30}"
GRAPHIFY_MAX_CONCURRENCY="${GRAPHIFY_MAX_CONCURRENCY:-1}"
GRAPHIFY_API_TIMEOUT="${GRAPHIFY_API_TIMEOUT:-900}"
GRAPHIFY_AST_WORKERS="${GRAPHIFY_AST_WORKERS:-12}"
GRAPHIFY_VIZ_NODE_LIMIT="${GRAPHIFY_VIZ_NODE_LIMIT:-30000}"
GRAPHIFY_PHASES="${GRAPHIFY_PHASES:-1 2 3 4}"
GRAPHIFY_FAST_TOKEN_BUDGET="${GRAPHIFY_FAST_TOKEN_BUDGET:-2500}"
GRAPHIFY_DOCS_TOKEN_BUDGET="${GRAPHIFY_DOCS_TOKEN_BUDGET:-3000}"
GRAPHIFY_MEDIA_TOKEN_BUDGET="${GRAPHIFY_MEDIA_TOKEN_BUDGET:-3000}"
GRAPHIFY_DEEP_TOKEN_BUDGET="${GRAPHIFY_DEEP_TOKEN_BUDGET:-4000}"
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
    log "reached ${SCHEDULER_CUTOFF_HOUR}:00 cutoff, not starting new work"
    return 1
  fi
  return 0
}

discover_repos() {
  local root
  for root in $REPO_ROOTS; do
    if [[ -d "$root" ]]; then
      find "$root" -maxdepth 5 -name .git -type d 2>/dev/null | sed 's#/.git$##'
    fi
  done | sort -u
}

write_graphifyignore_for_phase() {
  local repo="$1"
  local phase="$2"
  cat > "$repo/.graphifyignore" <<'EOF'
# Managed by Brain Graphify scheduler.
# Version control / dependencies
.git/
node_modules/
**/node_modules/

# Graphify generated output — never scan your own graph/report/html/cache
graphify-out/
.graphify-out/

# Local AI/runtime state
.ai/
.claude/
.local/
.gstack/
.pytest_cache/
__pycache__/
**/__pycache__/

# Build/test/generated output
.next/
dist/
build/
coverage/
*.tsbuildinfo
.DS_Store
**/.DS_Store

# Local tool caches
.wrangler/
**/.wrangler/
EOF

  case "$phase" in
    1)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Pass 1: fast code/config graph only.
# Skip semantic-heavy docs, papers, images, office files, and media.
*.md
**/*.md
*.mdx
**/*.mdx
docs/
**/docs/
*.pdf
**/*.pdf
*.png
**/*.png
*.jpg
**/*.jpg
*.jpeg
**/*.jpeg
*.webp
**/*.webp
*.gif
**/*.gif
*.svg
**/*.svg
*.docx
**/*.docx
*.xlsx
**/*.xlsx
*.pptx
**/*.pptx
*.mp3
**/*.mp3
*.mp4
**/*.mp4
*.mov
**/*.mov
*.wav
**/*.wav
EOF
      ;;
    2)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Pass 2: add Markdown/docs, still skip papers/images/office/media.
*.pdf
**/*.pdf
*.png
**/*.png
*.jpg
**/*.jpg
*.jpeg
**/*.jpeg
*.webp
**/*.webp
*.gif
**/*.gif
*.svg
**/*.svg
*.docx
**/*.docx
*.xlsx
**/*.xlsx
*.pptx
**/*.pptx
*.mp3
**/*.mp3
*.mp4
**/*.mp4
*.mov
**/*.mov
*.wav
**/*.wav
EOF
      ;;
    3)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Pass 3: add papers/images/office files, still skip audio/video.
*.mp3
**/*.mp3
*.mp4
**/*.mp4
*.mov
**/*.mov
*.wav
**/*.wav
EOF
      ;;
    4)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Pass 4: full/deep refinement. Only base generated/runtime/build exclusions apply.
EOF
      ;;
    *)
      log "unknown phase=$phase repo=$repo"
      return 1
      ;;
  esac
}

phase_label() {
  case "$1" in
    1) printf 'pass1-fast-code' ;;
    2) printf 'pass2-docs-markdown' ;;
    3) printf 'pass3-papers-images' ;;
    4) printf 'pass4-deep-refinement' ;;
    *) printf 'pass%s' "$1" ;;
  esac
}

phase_token_budget() {
  case "$1" in
    1) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
    2) printf '%s' "$GRAPHIFY_DOCS_TOKEN_BUDGET" ;;
    3) printf '%s' "$GRAPHIFY_MEDIA_TOKEN_BUDGET" ;;
    4) printf '%s' "$GRAPHIFY_DEEP_TOKEN_BUDGET" ;;
    *) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
  esac
}

run_graphify() {
  local repo="$1"
  shift
  OLLAMA_API_KEY="$OLLAMA_API_KEY" \
  OLLAMA_MODEL="$GRAPHIFY_MODEL" \
  GRAPHIFY_OLLAMA_NUM_CTX="$GRAPHIFY_OLLAMA_NUM_CTX" \
  GRAPHIFY_OLLAMA_KEEP_ALIVE="$GRAPHIFY_OLLAMA_KEEP_ALIVE" \
  GRAPHIFY_VIZ_NODE_LIMIT="$GRAPHIFY_VIZ_NODE_LIMIT" \
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

run_phase() {
  local repo="$1"
  local phase="$2"
  local label
  local token_budget
  label="$(phase_label "$phase")"
  token_budget="$(phase_token_budget "$phase")"

  mkdir -p "$repo/graphify-out/.scheduler"
  write_graphifyignore_for_phase "$repo" "$phase"

  local -a extract_cmd=(
    "$GRAPHIFY_BIN" extract "$repo"
    "--backend=$GRAPHIFY_BACKEND"
    --token-budget "$token_budget"
    --max-concurrency "$GRAPHIFY_MAX_CONCURRENCY"
    --api-timeout "$GRAPHIFY_API_TIMEOUT"
    --no-cluster
    --no-viz
  )

  if [[ "$phase" == "1" ]]; then
    extract_cmd+=(--max-workers "$GRAPHIFY_AST_WORKERS")
  fi

  if [[ "$phase" == "4" ]]; then
    extract_cmd+=(--mode deep)
  fi

  local -a cluster_cmd=(
    "$GRAPHIFY_BIN" cluster-only "$repo"
    "--backend=$GRAPHIFY_BACKEND"
  )

  if [[ "$phase" == "2" || "$phase" == "3" ]]; then
    cluster_cmd+=(--no-label)
  fi

  log "$label extract repo=$repo model=$GRAPHIFY_MODEL token-budget=$token_budget"
  run_graphify "$repo" "${extract_cmd[@]}"

  log "$label cluster repo=$repo viz-limit=$GRAPHIFY_VIZ_NODE_LIMIT"
  run_graphify "$repo" "${cluster_cmd[@]}"

  printf '%s\n' "$phase" > "$repo/graphify-out/.scheduler/last-successful-phase"
  printf '%s\n' "$(timestamp)" > "$repo/graphify-out/.scheduler/last-successful-phase-at"
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

log "graphify-nightly phased start backend=$GRAPHIFY_BACKEND model=$GRAPHIFY_MODEL phases='$GRAPHIFY_PHASES' max-concurrency=$GRAPHIFY_MAX_CONCURRENCY api-timeout=$GRAPHIFY_API_TIMEOUT"

repos=0
phases_ok=0
skipped=0
failed=0

while IFS= read -r repo; do
  [[ -n "$repo" ]] || continue
  repos=$((repos + 1))

  log "repo start path=$repo graph-present=$([[ -f "$repo/graphify-out/graph.json" ]] && printf yes || printf no)"

  for phase in $GRAPHIFY_PHASES; do
    if ! check_scheduler_cutoff; then
      log "skipping remaining phases repo=$repo reason=scheduler_cutoff"
      skipped=$((skipped + 1))
      break
    fi

    if run_phase "$repo" "$phase"; then
      phases_ok=$((phases_ok + 1))
      log "phase ok repo=$repo phase=$(phase_label "$phase")"
      log_outputs "$repo"
    else
      failed=$((failed + 1))
      log "phase failed repo=$repo phase=$(phase_label "$phase") — continuing to next repo"
      break
    fi
  done

done < <(discover_repos)

log "graphify-nightly phased complete repos=$repos phases_ok=$phases_ok skipped=$skipped failed=$failed"

if (( failed > 0 )); then
  exit 1
fi
