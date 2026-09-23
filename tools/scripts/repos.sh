#!/usr/bin/env bash
# repos — unified repository picker for Brain-backed runtimes.
# Invoked as the `repos` shell function (defined in ~/.zshrc).
#
# Step 1: choose a model/runtime surface.
# Step 2: choose a repository from ~/Repos.
# Brain-backed entries use the installed runtime's authenticated `submit`
# intake. Codex stays on its native CLI path and is never routed through Brain.

CACHE_FILE="$HOME/.claude/cache/repos.json"
USAGE_FILE="$HOME/.claude/cache/repo_usage.json"
REPOS_ROOT="$(cd "$HOME/Repos" 2>/dev/null && pwd -P)"
[[ -n "$REPOS_ROOT" ]] || REPOS_ROOT="$HOME/Repos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/brain-cli-resolver.sh"

scan_to_cache() {
  python3 - "$REPOS_ROOT" "$CACHE_FILE" <<'PYEOF'
import json
import os
import sys

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
temporary_cache = f"{cache}.{os.getpid()}.tmp"
with open(temporary_cache, 'w') as handle:
    json.dump(repos, handle)
os.replace(temporary_cache, cache)
PYEOF
}

cache_to_lines() {
  python3 - "$CACHE_FILE" "$USAGE_FILE" <<'PYEOF'
import json
import os
import sys

with open(sys.argv[1]) as handle:
    repos = json.load(handle)

usage = {}
if os.path.exists(sys.argv[2]):
    with open(sys.argv[2]) as handle:
        usage = json.load(handle)

repos.sort(key=lambda r: (-usage.get(r['path'], 0), r['account'], r['name']))
for repo in repos:
    print(f"{repo['account']}/{repo['name']}\t{repo['path']}")
PYEOF
}

record_usage() {
  python3 - "$USAGE_FILE" "$1" <<'PYEOF'
import json
import os
import sys
import time

usage_file, path = sys.argv[1], sys.argv[2]
usage = {}
if os.path.exists(usage_file):
    with open(usage_file) as handle:
        usage = json.load(handle)
usage[path] = time.time()
with open(usage_file, 'w') as handle:
    json.dump(usage, handle)
PYEOF
}

runtime_menu() {
  printf '%s\n' \
    'Auto' \
    'MiniMax M2.5' \
    'GLM-5' \
    'Opus 4.6' \
    'Codex'
}

launch_brain() {
  local model="$1"
  local repository_root="$PWD"
  local repository_ref
  if [[ "$repository_root" == "$REPOS_ROOT/"* ]]; then
    repository_ref="${repository_root#"$REPOS_ROOT/"}"
  else
    echo "Unable to launch Brain: selected repository is outside $REPOS_ROOT" >&2
    return 1
  fi

  brain_resolve_cli || {
    echo "Unable to launch Brain: $BRAIN_RESOLUTION_ERROR" >&2
    return 1
  }

  if [[ "${REPOS_LAUNCH_DRY_RUN:-0}" == "1" ]]; then
    printf 'cwd=%s\nmodel=%s\n' "$PWD" "$model"
    brain_resolution_summary
    if [[ "$model" == "auto" ]]; then
      printf 'args=submit --model auto --repository-ref %s --repository-root %s\n' "$repository_ref" "$repository_root"
    else
      printf 'args=submit --model %s --repository-ref %s --repository-root %s\n' "$model" "$repository_ref" "$repository_root"
    fi
    return 0
  fi

  if [[ "$model" == "auto" ]]; then
    exec "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI" submit --model auto --repository-ref "$repository_ref" --repository-root "$repository_root"
  fi
  exec "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI" submit --model "$model" --repository-ref "$repository_ref" --repository-root "$repository_root"
}

if [[ "${1:-}" == "--runtime-menu" ]]; then
  runtime_menu
  exit 0
fi
if [[ "${1:-}" == "--resolve-brain-cli" ]]; then
  brain_resolve_cli || {
    echo "Unable to resolve Brain CLI: $BRAIN_RESOLUTION_ERROR" >&2
    exit 1
  }
  brain_resolution_summary
  exit 0
fi
if [[ "${1:-}" == "--launch-brain-test" ]]; then
  launch_brain "${2:-auto}"
  exit $?
fi

if [[ "${1:-}" == "--model" ]]; then
  case "${2:-}" in
    auto) tool='Auto' ;;
    minimax-m2.5) tool='MiniMax M2.5' ;;
    glm-5) tool='GLM-5' ;;
    opus-4.6) tool='Opus 4.6' ;;
    codex) tool='Codex' ;;
    *) echo "Usage: repos [--model auto|minimax-m2.5|glm-5|opus-4.6|codex]" >&2; exit 2 ;;
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

[[ ! -f "$CACHE_FILE" ]] && scan_to_cache
scan_to_cache &
SCAN_PID=$!

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

case "$tool" in
  Codex)
    command -v codex >/dev/null 2>&1 || {
      echo 'Unable to launch Codex: codex executable not found on PATH' >&2
      exit 1
    }
    exec codex
    ;;
  Auto) launch_brain auto ;;
  'MiniMax M2.5') launch_brain minimax-m2.5 ;;
  'GLM-5') launch_brain glm-5 ;;
  'Opus 4.6') launch_brain opus-4.6 ;;
esac
