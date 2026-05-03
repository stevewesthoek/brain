#!/usr/bin/env bash
# jump — quick repo navigator (robust, race-condition safe)

set -euo pipefail

CACHE_FILE="${HOME}/.claude/cache/repos.json"
CACHE_TMP="${CACHE_FILE}.tmp.$$"
USAGE_FILE="${HOME}/.claude/cache/repo_usage.json"
USAGE_TMP="${USAGE_FILE}.tmp.$$"
REPOS_ROOT="${HOME}/Repos"
CACHE_LOCK="${HOME}/.claude/cache/.repos-lock"

mkdir -p "$(dirname "$CACHE_FILE")"

# Atomic write helper: write to temp file, fsync, atomic rename
write_json_atomic() {
  local target="$1"
  local tmp="${target}.tmp.$$"
  trap "rm -f '$tmp'" RETURN
  python3 -c "import sys; import json; data=json.load(sys.stdin); json.dump(data, open('$tmp', 'w'))" && \
    sync "$tmp" 2>/dev/null || true && \
    mv "$tmp" "$target"
}

# Scan repos with robust error handling
scan_repos() {
  python3 << 'SCAN_END'
import os, sys, json
root = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Repos")
repos = []
seen = set()

for dirpath, dirnames, files in os.walk(root, onerror=lambda e: None):
  # Safely filter subdirs (skip .git and hidden dirs)
  try:
    dirnames[:] = sorted([d for d in dirnames if d != '.git' and not d.startswith('.')])
  except (OSError, PermissionError):
    dirnames[:] = []

  # Check if this is a git repo
  try:
    if '.git' in os.listdir(dirpath):
      rel = os.path.relpath(dirpath, root)
      parts = rel.split(os.sep)
      account = parts[0] if len(parts) > 1 else "."
      repo_path = os.path.abspath(dirpath)

      # Prevent duplicates (shouldn't happen, but be safe)
      if repo_path not in seen:
        seen.add(repo_path)
        repos.append({
          "account": account,
          "name": os.path.basename(dirpath),
          "path": repo_path
        })

      # Don't traverse into git repos
      dirnames[:] = []
  except (OSError, PermissionError):
    pass

repos.sort(key=lambda r: (r['account'], r['name']))
json.dump(repos, sys.stdout)
SCAN_END
}

# Build cache if missing
if [[ ! -f "$CACHE_FILE" ]]; then
  scan_repos "$REPOS_ROOT" | write_json_atomic "$CACHE_FILE"
fi

# Rescan in background (atomic write, with lock to prevent concurrent writes)
(
  flock -n 9 2>/dev/null || exit 0
  scan_repos "$REPOS_ROOT" | write_json_atomic "$CACHE_FILE"
) 9>"$CACHE_LOCK" >/dev/null 2>&1 &

# Ensure cache file is valid before reading
if ! python3 -c "import json; json.load(open('$CACHE_FILE'))" 2>/dev/null; then
  scan_repos "$REPOS_ROOT" | write_json_atomic "$CACHE_FILE"
fi

# Show fzf selector with validated data
selected=$(python3 << 'SELECT_END' | fzf --prompt="  jump to repo: " --height=50% --layout=reverse --border=rounded --delimiter=$'\t' --with-nth=1 --preview='echo "  {2}"' --preview-window='down:1:wrap' --bind='tab:down,btab:up' 2>/dev/null || true
import json, os, sys, time
cache = os.path.expanduser("~/.claude/cache/repos.json")
usage = os.path.expanduser("~/.claude/cache/repo_usage.json")

try:
  repos = json.load(open(cache))
except (json.JSONDecodeError, FileNotFoundError):
  sys.exit(1)

try:
  usage_data = json.load(open(usage)) if os.path.exists(usage) else {}
except (json.JSONDecodeError, FileNotFoundError):
  usage_data = {}

# Sort by usage (recency), then account, then name; filter out deleted repos
valid_repos = [r for r in repos if os.path.isdir(r['path'])]
valid_repos.sort(key=lambda r: (-usage_data.get(r['path'], 0), r['account'], r['name']))

for r in valid_repos:
  print(f"{r['account']}/{r['name']}\t{r['path']}")
SELECT_END
)

# Validate selection and record usage atomically
if [[ -n "$selected" ]]; then
  path=$(echo "$selected" | cut -f2)

  # Double-check path exists and is readable
  if [[ -d "$path" ]] && cd "$path" 2>/dev/null; then
    # Record usage (best-effort, don't fail if it errors)
    python3 << RECORD_END >/dev/null 2>&1 || true
import json, os, sys, time
usage = os.path.expanduser("~/.claude/cache/repo_usage.json")
path = "$path"
try:
  data = json.load(open(usage)) if os.path.exists(usage) else {}
except (json.JSONDecodeError, FileNotFoundError):
  data = {}
data[path] = time.time()
try:
  with open(usage + ".tmp.$$", 'w') as f:
    json.dump(data, f)
  os.rename(usage + ".tmp.$$", usage)
except OSError:
  pass
RECORD_END
    echo "$path"
  fi
fi
