#!/usr/bin/env bash
# session-picker.sh — browse and resume Claude sessions with fzf.
# Shows all sessions ordered by most recent, with age and summary.
# On selection, opens Claude in the session's project directory and resumes it.

PROJECTS_DIR="$HOME/.claude/projects"

list_sessions() {
  python3 - "$PROJECTS_DIR" <<'PYEOF'
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

        # Timestamp + cwd from first entry that has one
        first_ts = None
        cwd = None
        for e in entries:
            if 'timestamp' in e:
                first_ts = e['timestamp']
                cwd = e.get('cwd') or cwd
                break

        if not first_ts:
            continue

        # First meaningful user message as summary
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
            # Skip system-injected XML blocks and empty strings
            if not text or text.startswith('<'):
                continue
            summary = text[:120].replace('\n', ' ')
            break

        if not summary:
            continue  # Skip sessions with no real user message

        sessions.append({
            'session_id': session_id,
            'cwd': cwd or '~',
            'timestamp': first_ts,
            'summary': summary,
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
            weeks = delta.days // 7
            age = f"{weeks}w ago"
        elif delta.days >= 1:
            age = f"{delta.days}d ago"
        elif total_hours >= 1:
            age = f"{total_hours}h ago"
        else:
            mins = delta.seconds // 60
            age = f"{mins}m ago"
    except Exception:
        age = "?"

    cwd = s['cwd'].replace(home, '~')
    # Show last 2 path components for brevity
    parts = [p for p in cwd.split('/') if p]
    short_proj = '/'.join(parts[-2:]) if len(parts) >= 2 else cwd

    # Columns: age | project | summary | full_cwd | session_id
    print(f"{age}\t{short_proj}\t{s['summary']}\t{s['cwd']}\t{s['session_id']}")
PYEOF
}

# Run fzf picker
selected=$(list_sessions | fzf \
  --prompt="  session: " \
  --height=60% \
  --layout=reverse \
  --border=rounded \
  --delimiter=$'\t' \
  --with-nth=1,2,3 \
  --header="age        project                  summary" \
  --preview='printf "  project:  %s\n  session:  %s\n\n  %s" "{4}" "{5}" "{3}"' \
  --preview-window='down:4:wrap' \
  --bind='tab:down,btab:up' \
  2>/dev/null
)

[[ -z "$selected" ]] && exit 0

selected_cwd=$(echo "$selected"  | cut -f4)
selected_sid=$(echo "$selected"  | cut -f5)

# Resume the session in its project directory
cd "$selected_cwd" && exec claude --resume "$selected_sid"
