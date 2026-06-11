#!/usr/bin/env bash
set -euo pipefail

REPO_ROOTS="${GRAPHIFY_REPO_ROOTS:-/Users/Office/Repos}"
REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-7200}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-graphify}"
GRAPHIFY_BACKEND="${GRAPHIFY_BACKEND:-ollama}"

# GRAPHIFY_MODEL remains a manual override. When it is not set, each phase chooses
# the smallest useful model for that phase.
GRAPHIFY_MODEL="${GRAPHIFY_MODEL:-}"
GRAPHIFY_FAST_MODEL="${GRAPHIFY_FAST_MODEL:-gemma4:e4b-mlx}"
GRAPHIFY_DOCS_FAST_MODEL="${GRAPHIFY_DOCS_FAST_MODEL:-$GRAPHIFY_FAST_MODEL}"
GRAPHIFY_REFINED_MODEL="${GRAPHIFY_REFINED_MODEL:-gemma4:12b-mlx}"
GRAPHIFY_DEEP_MODEL="${GRAPHIFY_DEEP_MODEL:-$GRAPHIFY_REFINED_MODEL}"

OLLAMA_API_KEY="${OLLAMA_API_KEY:-ollama}"
GRAPHIFY_OLLAMA_NUM_CTX="${GRAPHIFY_OLLAMA_NUM_CTX:-8192}"
GRAPHIFY_OLLAMA_KEEP_ALIVE="${GRAPHIFY_OLLAMA_KEEP_ALIVE:-30}"
GRAPHIFY_MAX_CONCURRENCY="${GRAPHIFY_MAX_CONCURRENCY:-1}"
GRAPHIFY_API_TIMEOUT="${GRAPHIFY_API_TIMEOUT:-900}"
GRAPHIFY_AST_WORKERS="${GRAPHIFY_AST_WORKERS:-12}"
GRAPHIFY_VIZ_NODE_LIMIT="${GRAPHIFY_VIZ_NODE_LIMIT:-30000}"

# Default nightly work is intentionally light. Heavier phases are available for
# explicit manual runs or targeted repos.
GRAPHIFY_PHASES="${GRAPHIFY_PHASES:-1 2a}"
GRAPHIFY_FAST_TOKEN_BUDGET="${GRAPHIFY_FAST_TOKEN_BUDGET:-2500}"
GRAPHIFY_DOCS_README_TOKEN_BUDGET="${GRAPHIFY_DOCS_README_TOKEN_BUDGET:-${GRAPHIFY_PHASE2_TOKEN_BUDGET:-1000}}"
GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET="${GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET:-1200}"
GRAPHIFY_MEDIA_TOKEN_BUDGET="${GRAPHIFY_MEDIA_TOKEN_BUDGET:-2000}"
GRAPHIFY_DEEP_TOKEN_BUDGET="${GRAPHIFY_DEEP_TOKEN_BUDGET:-3000}"
GRAPHIFY_MIN_NODE_RETENTION_PERCENT="${GRAPHIFY_MIN_NODE_RETENTION_PERCENT:-80}"
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
    if [[ -d "$root/.git" || -f "$root/.git" ]]; then
      printf '%s\n' "$root"
    elif [[ -d "$root" ]]; then
      find "$root" -maxdepth 5 -name .git -type d \
        -not -path '*/.claude/*' \
        -not -path '*/node_modules/*' \
        -not -path '*/graphify-out/*' \
        -not -path '*/.tmp/*' \
        -not -path '*/tmp/*' \
        -not -path '*/backup/*' \
        -not -path '*/backups/*' \
        2>/dev/null | sed 's#/.git$##'
    fi
  done | sort -u
}

append_media_exclusions() {
  local repo="$1"
  cat >> "$repo/.graphifyignore" <<'EOF'
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
}

write_graphifyignore_for_phase() {
  local repo="$1"
  local phase="$2"
  cat > "$repo/.graphifyignore" <<'EOF'
# Managed by Brain Graphify scheduler.
# Version control / dependencies
.git/
**/.git/
node_modules/
**/node_modules/

# Graphify generated output — never scan your own graph/report/html/cache
graphify-out/
.graphify-out/

# Scheduler safety: skip generated, temporary, archived, and nested-worktree noise.
.tmp/
**/.tmp/
tmp/
**/tmp/
logs/
**/logs/
runtime/
**/runtime/
archive/
**/archive/
archives/
**/archives/
backup/
**/backup/
backups/
**/backups/
vendor/
**/vendor/
vendors/
**/vendors/
*.log
**/*.log

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

# Phase 1: fast code/config graph only.
# Skip semantic-heavy docs, papers, images, office files, and media.
*.md
**/*.md
*.mdx
**/*.mdx
docs/
**/docs/
EOF
      append_media_exclusions "$repo"
      ;;
    2|2a)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 2a: README-style root Markdown only.
# This is the default docs refinement lane.
docs/
**/docs/
*.md
**/*.md
*.mdx
**/*.mdx
!README.md
!README.mdx
!README-*.md
!README_*.md
!readme.md
!Readme.md
EOF
      ;;
    2b)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 2b: limited docs batch.
# Include README-style files and first-level docs/*.md only.
*.md
**/*.md
*.mdx
**/*.mdx
!README.md
!README.mdx
!README-*.md
!README_*.md
!readme.md
!Readme.md
!docs/
!docs/*.md
!docs/*.mdx
EOF
      ;;
    3)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 3: richer selected-repo refinement.
# Include docs, papers, images, and office files; still skip audio/video.
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
    4|5)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 5: rare full/deep refinement. Only base generated/runtime/build exclusions apply.
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
    1) printf 'phase1-fast-code' ;;
    2|2a) printf 'phase2a-readme-docs' ;;
    2b) printf 'phase2b-limited-docs' ;;
    3) printf 'phase3-rich-refinement' ;;
    4|5) printf 'phase5-deep-refinement' ;;
    *) printf 'phase%s' "$1" ;;
  esac
}

phase_token_budget() {
  case "$1" in
    1) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
    2|2a) printf '%s' "$GRAPHIFY_DOCS_README_TOKEN_BUDGET" ;;
    2b) printf '%s' "$GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET" ;;
    3) printf '%s' "$GRAPHIFY_MEDIA_TOKEN_BUDGET" ;;
    4|5) printf '%s' "$GRAPHIFY_DEEP_TOKEN_BUDGET" ;;
    *) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
  esac
}

model_available() {
  local model="$1"
  ollama list 2>/dev/null | awk 'NR > 1 {print $1}' | grep -Fxq "$model"
}

phase_model_candidate() {
  if [[ -n "$GRAPHIFY_MODEL" ]]; then
    printf '%s' "$GRAPHIFY_MODEL"
    return 0
  fi
  case "$1" in
    1) printf '%s' "$GRAPHIFY_FAST_MODEL" ;;
    2|2a) printf '%s' "$GRAPHIFY_DOCS_FAST_MODEL" ;;
    2b) printf '%s' "$GRAPHIFY_DOCS_FAST_MODEL" ;;
    3) printf '%s' "$GRAPHIFY_REFINED_MODEL" ;;
    4|5) printf '%s' "$GRAPHIFY_DEEP_MODEL" ;;
    *) printf '%s' "$GRAPHIFY_FAST_MODEL" ;;
  esac
}

phase_model() {
  local phase="$1"
  local candidate
  candidate="$(phase_model_candidate "$phase")"

  if model_available "$candidate"; then
    printf '%s' "$candidate"
    return 0
  fi

  if [[ -n "$GRAPHIFY_MODEL" ]]; then
    return 1
  fi

  if model_available "$GRAPHIFY_REFINED_MODEL"; then
    printf '%s' "$GRAPHIFY_REFINED_MODEL"
    return 0
  fi

  return 1
}

graph_node_count() {
  local graph_path="$1"
  if [[ ! -f "$graph_path" ]]; then
    printf '0'
    return 0
  fi
  python3 - "$graph_path" <<'PY'
import json
import sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    nodes = data.get('nodes', [])
    print(len(nodes) if isinstance(nodes, list) else 0)
except Exception:
    print(0)
PY
}

run_graphify() {
  local repo="$1"
  local model="$2"
  shift 2
  OLLAMA_API_KEY="$OLLAMA_API_KEY" \
  OLLAMA_MODEL="$model" \
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

prepare_phase_graph_state() {
  local repo="$1"
  local phase="$2"
  local label="$3"
  local graph_path="$repo/graphify-out/graph.json"
  local snapshot_path="$repo/graphify-out/.scheduler/pre-${label}-graph.json"

  if [[ "$phase" == "1" || ! -f "$graph_path" ]]; then
    printf '0:%s\n' "$snapshot_path"
    return 0
  fi

  cp "$graph_path" "$snapshot_path"
  local previous_nodes
  previous_nodes="$(graph_node_count "$graph_path")"

  # Wider phases rebuild the current scope from cache instead of relying on
  # Graphify incremental mode to merge changed ignore rules correctly.
  rm -f \
    "$repo/graphify-out/graph.json" \
    "$repo/graphify-out/GRAPH_REPORT.md" \
    "$repo/graphify-out/graph.html" \
    "$repo/graphify-out/.graphify_analysis.json"

  printf '%s:%s\n' "$previous_nodes" "$snapshot_path"
}

restore_phase_graph_snapshot() {
  local repo="$1"
  local snapshot_path="$2"
  if [[ -f "$snapshot_path" ]]; then
    cp "$snapshot_path" "$repo/graphify-out/graph.json"
  fi
}

run_phase() {
  local repo="$1"
  local phase="$2"
  local label
  local token_budget
  local model
  label="$(phase_label "$phase")"
  token_budget="$(phase_token_budget "$phase")"
  model="$(phase_model "$phase")"

  mkdir -p "$repo/graphify-out/.scheduler"
  write_graphifyignore_for_phase "$repo" "$phase"

  local phase_state
  local previous_nodes
  local snapshot_path
  phase_state="$(prepare_phase_graph_state "$repo" "$phase" "$label")"
  previous_nodes="${phase_state%%:*}"
  snapshot_path="${phase_state#*:}"

  local -a extract_cmd=(
    "$GRAPHIFY_BIN" extract "$repo"
    "--backend=$GRAPHIFY_BACKEND"
    --token-budget "$token_budget"
    --max-concurrency "$GRAPHIFY_MAX_CONCURRENCY"
    --api-timeout "$GRAPHIFY_API_TIMEOUT"
  )

  if [[ "$phase" == "1" ]]; then
    extract_cmd+=(--max-workers "$GRAPHIFY_AST_WORKERS")
  else
    extract_cmd+=(--no-cluster --no-viz)
  fi

  if [[ "$phase" == "4" || "$phase" == "5" ]]; then
    extract_cmd+=(--mode deep)
  fi

  local -a cluster_cmd=(
    "$GRAPHIFY_BIN" cluster-only "$repo"
    "--backend=$GRAPHIFY_BACKEND"
  )

  if [[ "$phase" == "2" || "$phase" == "2a" || "$phase" == "2b" || "$phase" == "3" ]]; then
    cluster_cmd+=(--no-label)
  fi

  local extract_log="$repo/graphify-out/.scheduler/${label}-extract.log"
  local cluster_log="$repo/graphify-out/.scheduler/${label}-cluster.log"

  log "$label extract repo=$repo model=$model token-budget=$token_budget"
  if ! run_graphify "$repo" "$model" "${extract_cmd[@]}" > >(tee "$extract_log") 2> >(tee -a "$extract_log" >&2); then
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  if grep -q "Refusing to overwrite" "$extract_log"; then
    log "$label extract produced unsafe graph overwrite warning repo=$repo"
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  log "$label cluster repo=$repo model=$model viz-limit=$GRAPHIFY_VIZ_NODE_LIMIT"
  if ! run_graphify "$repo" "$model" "${cluster_cmd[@]}" > >(tee "$cluster_log") 2> >(tee -a "$cluster_log" >&2); then
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  if grep -q "Refusing to overwrite" "$cluster_log"; then
    log "$label cluster produced unsafe graph overwrite warning repo=$repo"
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  local required_output
  for required_output in graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html; do
    if [[ ! -f "$repo/$required_output" ]]; then
      log "$label missing required output repo=$repo file=$required_output"
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
  done

  if (( previous_nodes > 0 )); then
    local new_nodes
    local min_nodes
    new_nodes="$(graph_node_count "$repo/graphify-out/graph.json")"
    min_nodes=$(( previous_nodes * GRAPHIFY_MIN_NODE_RETENTION_PERCENT / 100 ))
    if (( new_nodes < min_nodes )); then
      log "$label refused suspicious graph shrink repo=$repo previous_nodes=$previous_nodes new_nodes=$new_nodes min_nodes=$min_nodes"
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
  fi

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

model_summary="override=${GRAPHIFY_MODEL:-none} fast=$GRAPHIFY_FAST_MODEL docs=$GRAPHIFY_DOCS_FAST_MODEL refined=$GRAPHIFY_REFINED_MODEL deep=$GRAPHIFY_DEEP_MODEL"
log "graphify-nightly phased start backend=$GRAPHIFY_BACKEND models=[$model_summary] phases='$GRAPHIFY_PHASES' max-concurrency=$GRAPHIFY_MAX_CONCURRENCY api-timeout=$GRAPHIFY_API_TIMEOUT"

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

# Cutoff/skipped work is not a failed Graphify run. The next scheduler window resumes.
exit 0
