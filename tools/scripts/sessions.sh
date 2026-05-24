#!/usr/bin/env bash
# sessions — unified session picker for Claude and Codex.
# Invoked as the `sessions` shell function (defined in ~/.zshrc).
#
# Step 1: pick AI tool with fzf (Claude is default).
# Step 2: pick a session from the chosen tool's history, ordered newest first.
#
# Claude sessions are read from ~/.claude/projects/**/*.jsonl.
# Codex sessions are read from ~/.codex/sessions/**/*.jsonl, with names
# resolved from ~/.codex/session_index.jsonl.
#
# On selection, cd to the session's original project directory and resume:
#   Claude → source Bedrock env, then `claude --resume <session_id>`
#   Codex  → `codex resume <session_id>`

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

list_claude_sessions() {
  python3 - "$HOME/.claude/projects" <<'PYEOF'
import os, sys, json
from datetime import datetime, timezone

projects_dir = sys.argv[1]
sessions = []
home = os.path.expanduser("~")

for project_dir in os.listdir(projects_dir):
    full_project = os.path.join(projects_dir, project_dir)
    if not os.path.isdir(full_project):
        continue
    for filename in sorted(os.listdir(full_project)):
        if not filename.endswith('.jsonl'):
            continue
        session_id = filename[:-6]
        filepath = os.path.join(full_project, filename)

        try:
            with open(filepath, 'r', errors='replace') as f:
                lines = f.readlines()
        except Exception:
            continue

        entries = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                continue

        if not entries:
            continue

        first_ts = None
        cwd = None
        for e in entries:
            if 'timestamp' in e:
                first_ts = e['timestamp']
                cwd = e.get('cwd') or cwd
                break

        if not first_ts:
            continue

        summary = None
        for e in entries:
            if e.get('type') != 'user':
                continue
            if e.get('isMeta'):
                continue
            msg = e.get('message', {})
            content = msg.get('content', '')
            if isinstance(content, str):
                text = content.strip()
            elif isinstance(content, list):
                text = ' '.join(
                    p.get('text', '') for p in content
                    if isinstance(p, dict) and p.get('type') == 'text'
                ).strip()
            else:
                continue
            if not text or text.startswith('<'):
                continue
            summary = text[:120].replace('\n', ' ')
            break

        if not summary:
            continue

        sessions.append({
            'session_id': session_id,
            'cwd': cwd or '~',
            'timestamp': first_ts,
            'summary': summary,
        })

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

    # Columns: age | project | summary | full_cwd | session_id
    print(f"{age}\t{short_proj}\t{s['summary']}\t{s['cwd']}\t{s['session_id']}")
PYEOF
}

list_codex_sessions() {
  python3 - "$HOME/.codex/sessions" "$HOME/.codex/session_index.jsonl" <<'PYEOF'
import os, sys, json
from datetime import datetime, timezone

sessions_dir, index_file = sys.argv[1], sys.argv[2]
home = os.path.expanduser("~")

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

        stem = filename[:-6]
        parts = stem.split('-')
        if len(parts) < 5:
            continue
        session_id = '-'.join(parts[-5:])

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

    # Columns: age | project | session name | full_cwd | session_id
    print(f"{age}\t{short_proj}\t{s['thread_name']}\t{s['cwd']}\t{s['id']}")
PYEOF
}

list_gemini_sessions() {
  python3 - "$HOME/.gemini" <<'PYEOF'
import os, sys, json
from datetime import datetime, timezone

gemini_dir = sys.argv[1]
home = os.path.expanduser("~")

# Load project path → name mapping
projects_file = os.path.join(gemini_dir, "projects.json")
try:
    with open(projects_file) as f:
        projects_map = json.load(f).get("projects", {})  # {"/abs/path": "name"}
except Exception:
    projects_map = {}

# Invert to name → abs path
name_to_path = {v: k for k, v in projects_map.items()}

tmp_dir = os.path.join(gemini_dir, "tmp")
all_sessions = []

if not os.path.isdir(tmp_dir):
    sys.exit(0)

for proj_name in os.listdir(tmp_dir):
    chats_dir = os.path.join(tmp_dir, proj_name, "chats")
    if not os.path.isdir(chats_dir):
        continue

    proj_path = name_to_path.get(proj_name, "")

    proj_sessions = []
    for filename in os.listdir(chats_dir):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(chats_dir, filename)
        try:
            with open(filepath) as f:
                data = json.load(f)
        except Exception:
            continue

        session_id = data.get("sessionId", filename[:-5])
        timestamp = data.get("lastUpdated") or data.get("startTime", "")
        if not timestamp:
            try:
                mtime = os.path.getmtime(filepath)
                timestamp = datetime.fromtimestamp(mtime, timezone.utc).isoformat()
            except Exception:
                continue

        # Extract first user message as summary
        summary = ""
        for msg in data.get("messages", []):
            if msg.get("type") != "user":
                continue
            parts = msg.get("content", [])
            if isinstance(parts, list):
                text = " ".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
            elif isinstance(parts, str):
                text = parts.strip()
            else:
                continue
            if text and not text.startswith("<"):
                summary = text[:120].replace("\n", " ")
                break

        if not summary:
            summary = session_id

        proj_sessions.append({
            "session_id": session_id,
            "cwd": proj_path or proj_name,
            "timestamp": timestamp,
            "summary": summary,
        })

    # Sort newest-first within project; resume index is 1-based position
    proj_sessions.sort(key=lambda s: s["timestamp"], reverse=True)
    for idx, s in enumerate(proj_sessions, start=1):
        s["resume_index"] = idx
        all_sessions.append(s)

all_sessions.sort(key=lambda s: s["timestamp"], reverse=True)

now = datetime.now(timezone.utc)
for s in all_sessions:
    try:
        ts = datetime.fromisoformat(s["timestamp"].replace("Z", "+00:00"))
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

    cwd = s["cwd"].replace(home, "~")
    parts = [p for p in cwd.split("/") if p]
    short_proj = "/".join(parts[-2:]) if len(parts) >= 2 else cwd

    # Columns: age | project | summary | full_cwd | resume_index
    print(f"{age}\t{short_proj}\t{s['summary']}\t{s['cwd']}\t{s['resume_index']}")
PYEOF
}

# Step 1: pick AI tool — Claude is default (first item)
tool=$(printf "Claude\nCodex\nGemini" | fzf \
  --prompt="  open with: " \
  --height=10 \
  --layout=reverse \
  --border=rounded \
  --bind='tab:down,btab:up' \
  2>/dev/null)
[[ -z "$tool" ]] && exit 0

# Step 2: pick session for the chosen tool
if [[ "$tool" == "Claude" ]]; then
  selected=$(list_claude_sessions | fzf \
    --prompt="  session (Claude): " \
    --height=60% \
    --layout=reverse \
    --border=rounded \
    --delimiter=$'\t' \
    --with-nth=1,2,3 \
    --header="age        project                  summary" \
    --preview='printf "  project:  %s\n  session:  %s\n\n  %s" "{4}" "{5}" "{3}"' \
    --preview-window='down:4:wrap' \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$selected" ]] && exit 0
  selected_cwd=$(echo "$selected" | cut -f4)
  selected_sid=$(echo "$selected" | cut -f5)
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/claude-bedrock-env.sh"
  cd "$selected_cwd" && exec claude --resume "$selected_sid" --model haiku
elif [[ "$tool" == "Codex" ]]; then
  selected=$(list_codex_sessions | fzf \
    --prompt="  session (Codex): " \
    --height=60% \
    --layout=reverse \
    --border=rounded \
    --delimiter=$'\t' \
    --with-nth=1,2,3 \
    --header="age        project                  session name" \
    --preview='printf "  project:  %s\n  session:  %s\n\n  %s" "{4}" "{5}" "{3}"' \
    --preview-window='down:4:wrap' \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$selected" ]] && exit 0
  selected_cwd=$(echo "$selected" | cut -f4)
  selected_sid=$(echo "$selected" | cut -f5)
  cd "$selected_cwd" && exec codex resume "$selected_sid"
elif [[ "$tool" == "Gemini" ]]; then
  selected=$(list_gemini_sessions | fzf \
    --prompt="  session (Gemini): " \
    --height=60% \
    --layout=reverse \
    --border=rounded \
    --delimiter=$'\t' \
    --with-nth=1,2,3 \
    --header="age        project                  summary" \
    --preview='printf "  project:  %s\n  session:  %s\n\n  %s" "{4}" "{5}" "{3}"' \
    --preview-window='down:4:wrap' \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$selected" ]] && exit 0
  selected_cwd=$(echo "$selected" | cut -f4)
  selected_idx=$(echo "$selected" | cut -f5)
  cd "$selected_cwd" && exec gemini --resume "$selected_idx"
fi
