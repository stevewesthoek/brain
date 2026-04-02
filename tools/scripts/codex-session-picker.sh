#!/usr/bin/env bash
# codex-session-picker.sh — browse and resume Codex sessions with fzf.
# Reads ~/.codex/session_index.jsonl for names, session files for cwd.
# On selection, cd to the session's project directory and resumes it.

SESSIONS_DIR="$HOME/.codex/sessions"
INDEX_FILE="$HOME/.codex/session_index.jsonl"

list_sessions() {
  python3 - "$SESSIONS_DIR" "$INDEX_FILE" <<'PYEOF'
import os, sys, json
from datetime import datetime, timezone

sessions_dir, index_file = sys.argv[1], sys.argv[2]
home = os.path.expanduser("~")

# Load session index for thread names and updated_at timestamps
index = {}
if os.path.exists(index_file):
    with open(index_file) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                entry = json.loads(line)
                index[entry['id']] = entry
            except Exception:
                continue

sessions = []

for root, dirs, files in os.walk(sessions_dir):
    for filename in sorted(files):
        if not filename.endswith('.jsonl'):
            continue
        filepath = os.path.join(root, filename)

        # Extract UUID from filename: rollout-<date>-<time>-<UUID>.jsonl
        # UUID is always the last 5 dash-separated segments
        stem = filename[:-6]  # strip .jsonl
        parts = stem.split('-')
        if len(parts) < 5:
            continue
        session_id = '-'.join(parts[-5:])

        # Read cwd from first line (session_meta)
        try:
            with open(filepath, 'r', errors='replace') as f:
                first_line = f.readline().strip()
            if not first_line:
                continue
            entry = json.loads(first_line)
            if entry.get('type') != 'session_meta':
                continue
            cwd = entry['payload'].get('cwd', '')
            raw_ts = entry.get('timestamp') or entry['payload'].get('timestamp', '')
        except Exception:
            continue

        # Prefer updated_at from index (more recent), fall back to session_meta timestamp
        idx = index.get(session_id, {})
        thread_name = idx.get('thread_name') or '(unnamed)'
        timestamp = idx.get('updated_at') or raw_ts

        if not timestamp:
            continue

        sessions.append({
            'id': session_id,
            'cwd': cwd,
            'timestamp': timestamp,
            'thread_name': thread_name,
        })

# Sort newest first
sessions.sort(key=lambda s: s['timestamp'], reverse=True)

now = datetime.now(timezone.utc)
for s in sessions:
    try:
        ts = datetime.fromisoformat(s['timestamp'].replace('Z', '+00:00'))
        delta = now - ts
        total_hours = delta.days * 24 + delta.seconds // 3600
        if delta.days >= 7:
            age = f"{delta.days // 7}w ago"
        elif delta.days >= 1:
            age = f"{delta.days}d ago"
        elif total_hours >= 1:
            age = f"{total_hours}h ago"
        else:
            age = f"{delta.seconds // 60}m ago"
    except Exception:
        age = "?"

    cwd = s['cwd'].replace(home, '~')
    parts = [p for p in cwd.split('/') if p]
    short_proj = '/'.join(parts[-2:]) if len(parts) >= 2 else cwd

    # Columns: age | project | thread_name | full_cwd | session_id
    print(f"{age}\t{short_proj}\t{s['thread_name']}\t{s['cwd']}\t{s['id']}")
PYEOF
}

# Run fzf picker
selected=$(list_sessions | fzf \
  --prompt="  session-codex: " \
  --height=60% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1,2,3 \
  --header="age        project                  session name" \
  --preview='printf "  project:  %s\n  session:  %s\n\n  %s" "{4}" "{5}" "{3}"' \
  --preview-window='down:4:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null
)

[[ -z "$selected" ]] && exit 0

selected_cwd=$(echo "$selected" | cut -f4)
selected_sid=$(echo "$selected" | cut -f5)

cd "$selected_cwd" && exec codex resume "$selected_sid"
