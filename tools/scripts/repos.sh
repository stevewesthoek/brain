#!/usr/bin/env bash
# repos — unified repo picker for Claude, Codex, and Gemini.
# Invoked as the `repos` shell function (defined in ~/.zshrc).
#
# Step 1: pick AI tool with fzf.
# Step 2: pick a repo from ~/Repos (sorted by most recently used).
# Step 3: for Claude, pick a clean model label ordered by cost.
# Opens the selected repo in the chosen interactive runtime.
#
# Repo list is cached at ~/.claude/cache/repos.json and rescanned in the
# background on every run to stay fresh. Usage timestamps are tracked in
# ~/.claude/cache/repo_usage.json so recently opened repos float to the top.

CACHE_FILE="$HOME/.claude/cache/repos.json"
USAGE_FILE="$HOME/.claude/cache/repo_usage.json"
REPOS_ROOT="$HOME/Repos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

scan_to_cache() {
  python3 - "$REPOS_ROOT" "$CACHE_FILE" <<'PYEOF'
import os, sys, json

root, cache = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(cache), exist_ok=True)
repos = []
for dirpath, dirnames, _ in os.walk(root):
    dirnames[:] = sorted(d for d in dirnames if d != '.git')
    if '.git' in os.listdir(dirpath):
        rel = os.path.relpath(dirpath, root)
        parts = rel.split(os.sep)
        account = parts[0] if len(parts) > 1 else "."
        name = os.path.basename(dirpath)
        repos.append({"account": account, "name": name, "path": dirpath})
        dirnames.clear()

repos.sort(key=lambda r: (r['account'], r['name']))
with open(cache, 'w') as f:
    json.dump(repos, f)
PYEOF
}

cache_to_lines() {
  python3 - "$CACHE_FILE" "$USAGE_FILE" <<'PYEOF'
import json, sys, os

with open(sys.argv[1]) as f:
    repos = json.load(f)

usage = {}
if os.path.exists(sys.argv[2]):
    with open(sys.argv[2]) as f:
        usage = json.load(f)

repos.sort(key=lambda r: (-usage.get(r['path'], 0), r['account'], r['name']))
for r in repos:
    print(f"{r['account']}/{r['name']}\t{r['path']}")
PYEOF
}

record_usage() {
  python3 - "$USAGE_FILE" "$1" <<'PYEOF'
import json, sys, os, time

usage_file, path = sys.argv[1], sys.argv[2]
usage = {}
if os.path.exists(usage_file):
    with open(usage_file) as f:
        usage = json.load(f)
usage[path] = time.time()
with open(usage_file, 'w') as f:
    json.dump(usage, f)
PYEOF
}

claude_clean_model_label() {
  local model_id="$1"
  local family="Claude"
  local major=""
  local minor=""

  if [[ "$model_id" =~ claude-([a-z]+)-([0-9]+)-([0-9]+) ]]; then
    case "${BASH_REMATCH[1]}" in
      haiku) family="Haiku" ;;
      sonnet) family="Sonnet" ;;
      opus) family="Opus" ;;
    esac
    major="${BASH_REMATCH[2]}"
    minor="${BASH_REMATCH[3]}"
    printf '%s %s.%s\n' "$family" "$major" "$minor"
    return
  fi

  case "$model_id" in
    *haiku*) family="Haiku" ;;
    *sonnet*) family="Sonnet" ;;
    *opus*) family="Opus" ;;
  esac
  printf '%s\n' "$family"
}

claude_model_menu_lines() {
  printf '%s\t%s\n' "$(claude_clean_model_label "${ANTHROPIC_DEFAULT_HAIKU_MODEL:-haiku}")" "${ANTHROPIC_DEFAULT_HAIKU_MODEL:-haiku}"
  printf '%s\t%s\n' "$(claude_clean_model_label "${ANTHROPIC_DEFAULT_SONNET_MODEL:-sonnet}")" "${ANTHROPIC_DEFAULT_SONNET_MODEL:-sonnet}"
  printf '%s\t%s\n' "$(claude_clean_model_label "${ANTHROPIC_DEFAULT_OPUS_MODEL:-opus}")" "${ANTHROPIC_DEFAULT_OPUS_MODEL:-opus}"
}

launch_claude() {
  local model_id="${1:-${ANTHROPIC_DEFAULT_HAIKU_MODEL:-haiku}}"

  exec claude --model "$model_id"
}

# Step 1: pick AI tool
tool=$(printf "Claude\nCodex\nGemini" | fzf \
  --prompt="  open with: " \
  --height=10 \
  --layout=reverse \
  --border=rounded \
  --bind='tab:down,btab:up' \
  2>/dev/null)
[[ -z "$tool" ]] && exit 0

# Bootstrap cache if missing
[[ ! -f "$CACHE_FILE" ]] && scan_to_cache

# Rescan in background to keep cache fresh
scan_to_cache &
SCAN_PID=$!

# Step 2: pick repo
selected=$(cache_to_lines | fzf \
  --prompt="  repo ($tool): " \
  --height=50% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1 \
  --preview='echo "  {2}"' \
  --preview-window='down:1:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null)

kill "$SCAN_PID" 2>/dev/null
wait "$SCAN_PID" 2>/dev/null || true

[[ -z "$selected" ]] && exit 0

selected_path=$(echo "$selected" | cut -f2)
record_usage "$selected_path"

cd "$selected_path" || exit 1
if [[ "$tool" == "Claude" ]]; then
  # Re-source immediately before launch so stale parent shells cannot keep
  # Claude Code on an unavailable Bedrock model.
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/claude-bedrock-env.sh"
  selected_model=$(claude_model_menu_lines | fzf \
    --prompt="  Claude model: " \
    --height=10 \
    --layout=reverse \
    --border=rounded \
    --delimiter=$'\t' \
    --with-nth=1 \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$selected_model" ]] && exit 0
  launch_claude "$(echo "$selected_model" | cut -f2)"
elif [[ "$tool" == "Codex" ]]; then
  exec codex
elif [[ "$tool" == "Gemini" ]]; then
  exec gemini
fi
