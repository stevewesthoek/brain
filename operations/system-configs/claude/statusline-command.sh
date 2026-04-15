#!/bin/sh
input=$(cat)
dir_full=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // ""')
dir=$(basename "$dir_full")
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // ""')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Outer session model from statusline payload (ground truth for the orchestrating session)
live_model_display=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)
if [ -n "$live_model_display" ]; then
  active_model=$(echo "$live_model_display" | sed 's/^Claude[[:space:]]*//; s/[[:space:]].*//' | tr '[:upper:]' '[:lower:]')
else
  active_model=$(jq -r '.model // "?"' "$HOME/.claude/settings.json" 2>/dev/null || echo "?")
fi

# Read tracking state
tracking_file="$HOME/.claude/model-tracking.json"
mode="default"
agents_seg=""

if [ -f "$tracking_file" ]; then
  mode=$(jq -r '.mode // "default"' "$tracking_file" 2>/dev/null)

  # Build per-agent display from agents array
  # Each agent: ● type(model) if running, ✓ type(model) if done
  agents_seg=$(python3 - "$tracking_file" <<'PY'
import json, sys

path = sys.argv[1]
try:
    with open(path) as f:
        state = json.load(f)
except Exception:
    state = {}

agents = state.get("agents", [])
if not agents:
    sys.exit(0)

parts = []
for a in agents:
    t = a.get("type", "agent")
    m = a.get("model", "?")
    s = a.get("status", "running")
    icon = "●" if s == "running" else "✓"
    parts.append(f"{icon} {t}({m})")

print("  ".join(parts))
PY
  )
fi

# Mode badge for skill-level context (shown on outer session model label)
mode_badge=""
case "$mode" in
  review)   mode_badge=" ◊" ;;
  research) mode_badge=" 🔍" ;;
  gemini)   mode_badge=" ⚙" ;;
  deploy)   mode_badge=" ⬆" ;;
  plan)     mode_badge=" ⊙" ;;
esac

# Assemble model segment:
# If agents are active, show:  outer-model  |  ● agent1(model)  ✓ agent2(model)
# Otherwise just show the outer model with mode badge
if [ -n "$agents_seg" ]; then
  session_seg="${active_model}${mode_badge}"
  model_seg="${session_seg}  |  ${agents_seg}"
else
  model_seg="${active_model}${mode_badge}"
fi

# Append context window size
if [ -n "$ctx_size" ] && [ "$ctx_size" != "null" ]; then
  ctx_label=$(awk "BEGIN { printf \"%.0fk\", $ctx_size/1000 }")
  model_seg="${model_seg} (${ctx_label})"
fi

# Progress bar (7 blocks, green filled)
if [ -n "$used_pct" ]; then
  filled=$(awk "BEGIN { f = int($used_pct / 100 * 7 + 0.5); if (f > 7) f = 7; print f }")
  green='\033[32m'
  reset='\033[0m'
  filled_blocks=""
  empty_blocks=""
  i=1
  while [ "$i" -le 7 ]; do
    if [ "$i" -le "$filled" ]; then
      filled_blocks="${filled_blocks}█"
    else
      empty_blocks="${empty_blocks}░"
    fi
    i=$((i + 1))
  done
  ctx_seg=$(printf "${green}%s${reset}%s %.0f%%" "$filled_blocks" "$empty_blocks" "$used_pct")
else
  ctx_seg=""
fi

# Clickable folder hyperlink (OSC 8)
if [ -n "$dir_full" ] && [ "$dir_full" != "null" ]; then
  dir_link=$(printf '\033]8;;file://%s\033\\\033[1m\033[38;5;61m%s\033[0m\033]8;;\033\\' "$dir_full" "$dir")
else
  dir_link="$dir"
fi

# Assemble output
parts="$dir_link"
[ -n "$model_seg" ] && parts="$parts  |  $model_seg"
[ -n "$ctx_seg" ]   && parts="$parts  |  $ctx_seg"

printf "%b" "$parts"
