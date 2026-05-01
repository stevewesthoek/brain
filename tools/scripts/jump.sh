#!/usr/bin/env bash

# jump — quick repo navigator.
# Lists all repos across ~/Repos (sorted by most recently used).
# On selection, outputs the path so the shell can cd to it.

CACHE_FILE="$HOME/.claude/cache/repos.json"
USAGE_FILE="$HOME/.claude/cache/repo_usage.json"
REPOS_ROOT="$HOME/Repos"

# Scan repos and cache them
scan_to_cache() {
  python3 - "$REPOS_ROOT" "$CACHE_FILE" << 'PYSCRIPT'
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
PYSCRIPT
}

# Record usage timestamp
record_usage() {
  local path="$1"
  python3 - "$USAGE_FILE" "$path" << 'PYSCRIPT'
import json, os, time, sys

usage_file, path = sys.argv[1], sys.argv[2]
usage = {}
if os.path.exists(usage_file):
    with open(usage_file) as f:
        usage = json.load(f)
usage[path] = time.time()
with open(usage_file, 'w') as f:
    json.dump(usage, f)
PYSCRIPT
}

# Generate sorted repo list
get_repo_list() {
  python3 - "$CACHE_FILE" "$USAGE_FILE" << 'PYSCRIPT'
import json, os, sys

cache_file, usage_file = sys.argv[1], sys.argv[2]

with open(cache_file) as f:
    repos = json.load(f)

usage = {}
if os.path.exists(usage_file):
    with open(usage_file) as f:
        usage = json.load(f)

repos.sort(key=lambda r: (-usage.get(r['path'], 0), r['account'], r['name']))
for r in repos:
    print(f"{r['account']}/{r['name']}\t{r['path']}")
PYSCRIPT
}

# Bootstrap cache if missing
if [[ ! -f "$CACHE_FILE" ]]; then
  scan_to_cache >/dev/null 2>&1
fi

# Rescan in background
scan_to_cache >/dev/null 2>&1 &

# Get repo list and prompt with fzf
selected=$(get_repo_list 2>/dev/null | fzf \
  --prompt="  jump to repo: " \
  --height=50% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1 \
  --preview='echo "  {2}"' \
  --preview-window='down:1:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null) || true

# Extract path and output it
if [[ -n "$selected" ]]; then
  selected_path=$(echo "$selected" | cut -f2)
  record_usage "$selected_path" >/dev/null 2>&1 &
  printf '%s\n' "$selected_path"
fi
