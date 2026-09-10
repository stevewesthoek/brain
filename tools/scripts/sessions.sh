#!/usr/bin/env bash
# sessions — unified session picker for Brain and specialist runtimes.
# Invoked as the `sessions` shell function (defined in ~/.zshrc).
#
# Step 1: always present the model/runtime selector; Auto is first and preselected.
# Step 2: pick a session from the chosen tool's history, ordered newest first.
#
# Codex sessions are read from ~/.codex/sessions/**/*.jsonl, with names
# resolved from ~/.codex/session_index.jsonl.
#
# On selection, cd to the session's original project directory and resume:
#   Brain  → durable Brain control action for the selected run
#   Codex  → `codex resume <session_id>`

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

list_brain_sessions() {
  python3 - "${BRAIN_CORE_URL:-http://127.0.0.1:4877}" "${1:-}" <<'PYEOF'
import json, sys, urllib.request

url = sys.argv[1].rstrip('/') + '/agent-console'
selected_model = sys.argv[2]
try:
    with urllib.request.urlopen(url, timeout=2) as response:
        body = json.load(response)
except Exception:
    # Missing Brain StateStore/API means no sessions, never synthetic rows.
    raise SystemExit(0)

agent_mode = body.get('agentMode') or {}
if agent_mode.get('availability') != 'available':
    raise SystemExit(0)
for attempt in agent_mode.get('attempts', []):
    attempt_id = str(attempt.get('attemptId') or '').strip()
    if not attempt_id:
        continue
    model = str(attempt.get('modelRef') or 'unknown')
    model_display = {
        'agent-mode/minimax-m2.5': 'MiniMax M2.5',
        'agent-mode/glm-5': 'GLM-5',
        'agent-mode/claude-opus-4.6': 'Opus 4.6',
    }.get(model, model)
    if selected_model and selected_model != model_display:
        continue
    status = str(attempt.get('status') or 'unknown')
    runtime = str(attempt.get('runtimeRef') or 'unknown')
    updated = str(attempt.get('updatedAt') or attempt.get('createdAt') or '?')
    run_id = str(attempt.get('runId') or attempt_id).strip()
    # Columns: last activity | repository | session/model | runtime | attempt id | run id
    view = 'Auto' if not selected_model else model_display
    print(f"{updated}\tunknown\tBrain · {view} · {model_display} · {status}\t{runtime}\t{attempt_id}\t{run_id}")
PYEOF
}

runtime_menu() {
  printf '%s\n' 'Auto' 'MiniMax M2.5' 'GLM-5' 'Opus 4.6' 'Codex'
}

if [[ "${1:-}" == "--runtime-menu" ]]; then
  runtime_menu
  exit 0
fi
if [[ "${1:-}" == "--choose-model" ]]; then
  shift
fi
if [[ "${1:-}" == "--list-brain" ]]; then
  list_brain_sessions
  exit 0
fi

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

if [[ "${1:-}" == "--model" ]]; then
  case "${2:-}" in
    auto) tool='Auto' ;;
    minimax-m2.5) tool='MiniMax M2.5' ;;
    glm-5) tool='GLM-5' ;;
    opus-4.6) tool='Opus 4.6' ;;
    codex) tool='Codex' ;;
    *) echo "Usage: sessions [--model auto|minimax-m2.5|glm-5|opus-4.6|codex]" >&2; exit 2 ;;
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

# Step 2: pick session for the chosen tool
if [[ "$tool" == "Auto" || "$tool" == "MiniMax M2.5" || "$tool" == "GLM-5" || "$tool" == "Opus 4.6" ]]; then
  selected=$(list_brain_sessions "$([[ "$tool" == "Auto" ]] || echo "$tool")" | fzf \
    --prompt="  session (Brain/$tool): " \
    --height=60% \
    --layout=reverse \
    --border=rounded \
    --delimiter=$'\t' \
    --with-nth=1,2,3,4,5 \
    --header="last activity  repository  session/model  runtime" \
    --preview='printf "  repository: %s\n  session:    %s\n  runtime:    %s\n  attempt:    %s\n  run:       %s" "{2}" "{3}" "{4}" "{5}" "{6}"' \
    --preview-window='down:5:wrap' \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$selected" ]] && exit 0
  selected_sid=$(echo "$selected" | cut -f6)
  action=$(printf '%s\n' inspect pause resume cancel kill | fzf \
    --prompt="  Brain action ($selected_sid): " \
    --height=10 \
    --layout=reverse \
    --border=rounded \
    --bind='tab:down,btab:up' \
    2>/dev/null)
  [[ -z "$action" ]] && exit 0
  command -v brain-agent >/dev/null 2>&1 || {
    echo "brain-agent is not on PATH; cannot control Brain session." >&2
    exit 1
  }
  exec brain-agent "$action" "$selected_sid"
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
fi
