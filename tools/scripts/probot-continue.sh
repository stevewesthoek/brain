#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: probot-continue.sh <repo-path> [auto|claude|codex|gemini]" >&2
  exit 1
fi

REPO_PATH="$(python3 - "$1" <<'PY'
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
)"
TOOL="${2:-auto}"

if [[ ! -d "$REPO_PATH" ]]; then
  echo "Repo path does not exist: $REPO_PATH" >&2
  exit 1
fi

SESSION_NAME="$(python3 - "$REPO_PATH" <<'PY'
import os, re, sys
base = os.path.basename(sys.argv[1].rstrip("/")) or "repo"
slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")[:24] or "repo"
print(f"work-{slug}")
PY
)"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  exec tmux attach -t "$SESSION_NAME"
fi

LAUNCH_CMD="$(python3 - "$REPO_PATH" "$TOOL" <<'PY'
import json, os, shlex, sys
from datetime import datetime, timezone

repo_path = os.path.realpath(sys.argv[1])
wanted_tool = sys.argv[2].lower()
home = os.path.expanduser("~")

def parse_iso(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None

def latest_claude():
    root = os.path.join(home, ".claude", "projects")
    best = None
    if not os.path.isdir(root):
        return None
    for project_dir in os.listdir(root):
        full_project = os.path.join(root, project_dir)
        if not os.path.isdir(full_project):
            continue
        for filename in os.listdir(full_project):
            if not filename.endswith(".jsonl"):
                continue
            filepath = os.path.join(full_project, filename)
            try:
                with open(filepath, "r", errors="replace") as f:
                    entries = [json.loads(line) for line in f if line.strip()]
            except Exception:
                continue
            first = next((e for e in entries if isinstance(e, dict) and isinstance(e.get("cwd"), str)), None)
            if not first:
                continue
            cwd = os.path.realpath(first["cwd"])
            if not (cwd == repo_path or cwd.startswith(repo_path + os.sep)):
                continue
            ts = parse_iso(first.get("timestamp", ""))
            if not ts:
                continue
            candidate = ("claude", ts, filename[:-6])
            if best is None or ts > best[1]:
                best = candidate
    return best

def load_codex_index():
    index_path = os.path.join(home, ".codex", "session_index.jsonl")
    index = {}
    if not os.path.exists(index_path):
        return index
    with open(index_path, "r", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            if isinstance(entry, dict) and entry.get("id"):
                index[entry["id"]] = entry
    return index

def latest_codex():
    root = os.path.join(home, ".codex", "sessions")
    if not os.path.isdir(root):
        return None
    index = load_codex_index()
    best = None
    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            if not filename.endswith(".jsonl"):
                continue
            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, "r", errors="replace") as f:
                    first_line = next((line.strip() for line in f if line.strip()), "")
                if not first_line:
                    continue
                entry = json.loads(first_line)
            except Exception:
                continue
            if not isinstance(entry, dict) or entry.get("type") != "session_meta":
                continue
            payload = entry.get("payload") or {}
            cwd_raw = payload.get("cwd")
            if not isinstance(cwd_raw, str):
                continue
            cwd = os.path.realpath(cwd_raw)
            if not (cwd == repo_path or cwd.startswith(repo_path + os.sep)):
                continue
            stem = filename[:-6]
            parts = stem.split("-")
            if len(parts) < 5:
                continue
            session_id = "-".join(parts[-5:])
            idx = index.get(session_id) or {}
            timestamp = idx.get("updated_at") if isinstance(idx, dict) else None
            if not timestamp:
                timestamp = entry.get("timestamp") or payload.get("timestamp")
            ts = parse_iso(timestamp or "")
            if not ts:
                continue
            candidate = ("codex", ts, session_id)
            if best is None or ts > best[1]:
                best = candidate
    return best

def latest_gemini():
    gemini_dir = os.path.join(home, ".gemini")
    projects_file = os.path.join(gemini_dir, "projects.json")
    tmp_dir = os.path.join(gemini_dir, "tmp")
    if not os.path.isdir(tmp_dir):
        return None
    try:
        with open(projects_file, "r", errors="replace") as f:
            projects_map = json.load(f).get("projects", {})
    except Exception:
        projects_map = {}

    target_project_name = None
    for raw_path, name in projects_map.items():
        if os.path.realpath(raw_path) == repo_path:
            target_project_name = name
            break
    if not target_project_name:
        return None

    chats_dir = os.path.join(tmp_dir, target_project_name, "chats")
    if not os.path.isdir(chats_dir):
        return None

    rows = []
    for filename in os.listdir(chats_dir):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(chats_dir, filename)
        try:
            with open(filepath, "r", errors="replace") as f:
                data = json.load(f)
        except Exception:
            continue
        timestamp = data.get("lastUpdated") or data.get("startTime")
        if not timestamp:
            try:
                timestamp = datetime.fromtimestamp(os.path.getmtime(filepath), timezone.utc).isoformat()
            except Exception:
                continue
        ts = parse_iso(timestamp)
        if ts:
            rows.append((ts, filename))
    rows.sort(key=lambda row: row[0], reverse=True)
    if not rows:
        return None
    return ("gemini", rows[0][0], "1")

options = []
if wanted_tool in ("auto", "claude"):
    item = latest_claude()
    if item:
        options.append(item)
if wanted_tool in ("auto", "codex"):
    item = latest_codex()
    if item:
        options.append(item)
if wanted_tool in ("auto", "gemini"):
    item = latest_gemini()
    if item:
        options.append(item)

if options:
    tool, _, ident = sorted(options, key=lambda item: item[1], reverse=True)[0]
    if tool == "claude":
        cmd = f"cd {shlex.quote(repo_path)} && claude --resume {shlex.quote(ident)}"
    elif tool == "codex":
        cmd = f"cd {shlex.quote(repo_path)} && codex resume {shlex.quote(ident)}"
    else:
        cmd = f"cd {shlex.quote(repo_path)} && gemini --resume {shlex.quote(ident)}"
else:
    shell = os.environ.get("SHELL", "/bin/zsh")
    cmd = f"cd {shlex.quote(repo_path)} && exec {shlex.quote(shell)} -l"

print(cmd)
PY
)"

tmux new-session -ds "$SESSION_NAME" -c "$REPO_PATH" "/bin/zsh -lc $(python3 - "$LAUNCH_CMD" <<'PY'
import shlex, sys
print(shlex.quote(sys.argv[1]))
PY
)"
exec tmux attach -t "$SESSION_NAME"
