#!/usr/bin/env bash
# repos — unified repo picker for Claude and Codex.
# Invoked as the `repos` shell function (defined in ~/.zshrc).
#
# Step 1: pick AI tool with fzf (Claude is default).
# Step 2: pick a repo from ~/Repos (sorted by most recently used).
# Opens the selected repo in Claude (`claude`) or Codex (`codex`).
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

# Step 1: pick AI tool — Claude is default (first item)
tool=$(printf "Claude\nCodex\nGemini\nQWEN" | fzf \
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
  exec claude
elif [[ "$tool" == "Codex" ]]; then
  exec codex
elif [[ "$tool" == "Gemini" ]]; then
  exec gemini
else
  exec qwen
fi
