#!/usr/bin/env bash
# jump — quick repo navigator.
# Invoked as the `jump` shell function (defined in ~/.zshrc).
#
# Lists all repos across ~/Repos (sorted by most recently used).
# On selection, cd to that repo.
#
# Repo list is cached at ~/.claude/cache/repos.json and rescanned in the
# background on every run to stay fresh. Usage timestamps are tracked in
# ~/.claude/cache/repo_usage.json so recently opened repos float to the top.

CACHE_FILE="$HOME/.claude/cache/repos.json"
USAGE_FILE="$HOME/.claude/cache/repo_usage.json"
REPOS_ROOT="$HOME/Repos"

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

# Bootstrap cache if missing
[[ ! -f "$CACHE_FILE" ]] && scan_to_cache

# Rescan in background to keep cache fresh
scan_to_cache &
SCAN_PID=$!

# Generate repo list to temp file
TEMP_LIST=$(mktemp)
python3 - "$CACHE_FILE" "$USAGE_FILE" "$TEMP_LIST" <<'PYEOF'
import json, sys, os

with open(sys.argv[1]) as f:
    repos = json.load(f)

usage = {}
if os.path.exists(sys.argv[2]):
    with open(sys.argv[2]) as f:
        usage = json.load(f)

repos.sort(key=lambda r: (-usage.get(r['path'], 0), r['account'], r['name']))
with open(sys.argv[3], 'w') as out:
    for r in repos:
        out.write(f"{r['account']}/{r['name']}\t{r['path']}\n")
PYEOF

# Pick repo via fzf
selected=$(cat "$TEMP_LIST" | fzf \
  --prompt="  jump to repo: " \
  --height=50% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1 \
  --preview='echo "  {2}"' \
  --preview-window='down:1:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null)

rm -f "$TEMP_LIST"
kill "$SCAN_PID" 2>/dev/null
wait "$SCAN_PID" 2>/dev/null || true

[[ -z "$selected" ]] && exit 0

selected_path=$(echo "$selected" | cut -f2)
record_usage "$selected_path"

echo "$selected_path"
