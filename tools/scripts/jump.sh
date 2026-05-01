#!/usr/bin/env bash
# jump — quick repo navigator

CACHE_FILE="${HOME}/.claude/cache/repos.json"
USAGE_FILE="${HOME}/.claude/cache/repo_usage.json"
REPOS_ROOT="${HOME}/Repos"

mkdir -p "$(dirname "$CACHE_FILE")"

# Build cache if missing
if [[ ! -f "$CACHE_FILE" ]]; then
  python3 - "$REPOS_ROOT" "$CACHE_FILE" << 'SCAN_SCRIPT'
import os, sys, json
root, cache = sys.argv[1], sys.argv[2]
repos = []
for dirpath, dirnames, _ in os.walk(root):
    dirnames[:] = sorted(d for d in dirnames if d != '.git')
    if '.git' in os.listdir(dirpath):
        rel = os.path.relpath(dirpath, root)
        parts = rel.split(os.sep)
        account = parts[0] if len(parts) > 1 else "."
        repos.append({"account": account, "name": os.path.basename(dirpath), "path": dirpath})
        dirnames.clear()
repos.sort(key=lambda r: (r['account'], r['name']))
with open(cache, 'w') as f: json.dump(repos, f)
SCAN_SCRIPT
fi

# Rescan in background (don't wait)
python3 - "$REPOS_ROOT" "$CACHE_FILE" << 'SCAN_SCRIPT' >/dev/null 2>&1 &
import os, sys, json
root, cache = sys.argv[1], sys.argv[2]
repos = []
for dirpath, dirnames, _ in os.walk(root):
    dirnames[:] = sorted(d for d in dirnames if d != '.git')
    if '.git' in os.listdir(dirpath):
        rel = os.path.relpath(dirpath, root)
        parts = rel.split(os.sep)
        account = parts[0] if len(parts) > 1 else "."
        repos.append({"account": account, "name": os.path.basename(dirpath), "path": dirpath})
        dirnames.clear()
repos.sort(key=lambda r: (r['account'], r['name']))
with open(cache, 'w') as f: json.dump(repos, f)
SCAN_SCRIPT

# Show fzf selector
selected=$(python3 - "$CACHE_FILE" "$USAGE_FILE" << 'LIST_PYTHON' | fzf --prompt="  jump to repo: " --height=50% --layout=reverse --border=rounded --delimiter=$'\t' --with-nth=1 --preview='echo "  {2}"' --preview-window='down:1:wrap' --bind='tab:down,btab:up' 2>/dev/null
import json, os, sys
cache, usage = sys.argv[1], sys.argv[2]
repos = json.load(open(cache))
usage_data = json.load(open(usage)) if os.path.exists(usage) else {}
repos.sort(key=lambda r: (-usage_data.get(r['path'], 0), r['account'], r['name']))
for r in repos: print(f"{r['account']}/{r['name']}\t{r['path']}")
LIST_PYTHON
)

# Record usage and output path
if [[ -n "$selected" ]]; then
  path=$(echo "$selected" | cut -f2)
  python3 - "$USAGE_FILE" "$path" << 'RECORD_SCRIPT' >/dev/null 2>&1 &
import json, os, sys, time
usage_file, path = sys.argv[1], sys.argv[2]
data = json.load(open(usage_file)) if os.path.exists(usage_file) else {}
data[path] = time.time()
with open(usage_file, 'w') as f: json.dump(data, f)
RECORD_SCRIPT
  echo "$path"
fi
