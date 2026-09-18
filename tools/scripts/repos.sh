#!/usr/bin/env bash
# repos — unified repository picker for Brain and specialist runtimes.
# Invoked as the `repos` shell function (defined in ~/.zshrc).
#
# Step 1: always present the model/runtime selector; Auto is first and preselected.
# Step 2: pick a repo from ~/Repos (sorted by most recently used).
# Opens the selected repo in the chosen interactive runtime.
#
# Repo list is cached at ~/.claude/cache/repos.json and rescanned in the
# background on every run to stay fresh. Usage timestamps are tracked in
# ~/.claude/cache/repo_usage.json so recently opened repos float to the top.
#
CACHE_FILE="$HOME/.claude/cache/repos.json"
USAGE_FILE="$HOME/.claude/cache/repo_usage.json"
REPOS_ROOT="$HOME/Repos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_REPOSITORY_ROOT="${BRAIN_REPOSITORY_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd -P)}"
source "$SCRIPT_DIR/brain-cli-resolver.sh"

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

launch_brain() {
  # brain-agent is the canonical Brain task entrypoint and owns authenticated
  # Jarvis intake plus K4 admission. The legacy fixture `run` command remains
  # available explicitly for deterministic tests, but repos never invokes it.
  # The resolved invocation is: brain-agent submit --model ...
  local model="$1"
  local repository_ref
  repository_ref="${PWD#"$REPOS_ROOT"/}"
  [[ "$repository_ref" == "$PWD" ]] && repository_ref="$(basename "$PWD")"
  brain_resolve_cli || {
    echo "Unable to launch Brain: $BRAIN_RESOLUTION_ERROR" >&2
    return 1
  }
  if [[ "${REPOS_LAUNCH_DRY_RUN:-0}" == "1" ]]; then
    printf 'cwd=%s\nmodel=%s\n' "$PWD" "$model"
    brain_resolution_summary
    if [[ "$model" == "auto" ]]; then
      printf 'args=submit --repository-ref %s --repository-root %s\n' "$repository_ref" "$PWD"
    else
      printf 'args=submit --model %s --repository-ref %s --repository-root %s\n' "$model" "$repository_ref" "$PWD"
    fi
    return 0
  fi
  if [[ "$model" == "auto" ]]; then
    exec "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI" submit --model auto --repository-ref "$repository_ref" --repository-root "$PWD"
  fi
  exec "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI" submit --model "$model" --repository-ref "$repository_ref" --repository-root "$PWD"
}

runtime_menu() {
  printf '%s\n' \
    'Auto' \
    'Codex'
}

if [[ "${1:-}" == "--runtime-menu" ]]; then
  runtime_menu
  exit 0
fi
if [[ "${1:-}" == "--resolve-brain-cli" ]]; then
  brain_resolve_cli || { echo "Unable to resolve Brain CLI: $BRAIN_RESOLUTION_ERROR" >&2; exit 1; }
  brain_resolution_summary
  exit 0
fi
if [[ "${1:-}" == "--launch-brain-test" ]]; then
  launch_brain "${2:-auto}"
  exit $?
fi
if [[ "${1:-}" == "--choose-model" ]]; then
  shift
fi

if [[ "${1:-}" == "--model" ]]; then
  case "${2:-}" in
    auto) tool='Auto' ;;
    codex) tool='Codex' ;;
    *) echo "Usage: repos [--model auto|codex]" >&2; exit 2 ;;
  esac
else
  tool=$(runtime_menu | fzf \
    --prompt="  open with: " \
    --height=10 \
    --no-sort \
    --layout=reverse \
    --border=rounded \
    --bind='tab:down,btab:up' \
    2>/dev/null)
fi
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
if [[ "$tool" == "Codex" ]]; then
  launch_brain codex
elif [[ "$tool" == "Auto" ]]; then
  launch_brain auto
fi
