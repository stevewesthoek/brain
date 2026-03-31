#!/usr/bin/env bash
# Repo picker — outputs the selected repo path to stdout. Nothing else.
# The caller decides what to do with the path (open Claude, cd, etc.)

CACHE_FILE="$HOME/.claude/cache/repos.json"
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

cache_to_lines() {
  python3 - "$CACHE_FILE" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    repos = json.load(f)
for r in repos:
    print(f"{r['account']}/{r['name']}\t{r['path']}")
PYEOF
}

# Bootstrap cache if missing
[[ ! -f "$CACHE_FILE" ]] && scan_to_cache

# Rescan in background to keep cache fresh
scan_to_cache &
SCAN_PID=$!

# Show picker
selected=$(cache_to_lines | fzf \
  --prompt="  repo: " \
  --height=50% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1 \
  --preview='echo "  {2}"' \
  --preview-window='down:1:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null
)

kill "$SCAN_PID" 2>/dev/null
wait "$SCAN_PID" 2>/dev/null || true

[[ -z "$selected" ]] && exit 0

# Output path only — caller opens Claude
echo "$selected" | cut -f2
