#!/bin/sh
input=$(cat)
dir_full=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // ""')
dir=$(basename "$dir_full")
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // ""')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Get the ACTUAL live model from Claude Code's statusline payload
# .model.display_name values: "Haiku", "Sonnet", "Opus" (short, no "Claude" prefix)
# or legacy long-form: "Claude Haiku 4.5", "Claude Sonnet 4.6"
live_model_display=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)

# Normalize to short lowercase label
if [ -n "$live_model_display" ]; then
  # Remove "Claude " prefix if present, take first word, lowercase
  active_model=$(echo "$live_model_display" | sed 's/^Claude[[:space:]]*//; s/[[:space:]].*//' | tr '[:upper:]' '[:lower:]')
else
  # No model in payload — fall back to session model from settings
  active_model=$(jq -r '.model // "?"' "$HOME/.claude/settings.json" 2>/dev/null || echo "?")
fi

# Read badge enrichment from tracking file (reason, agent, context)
tracking_file="$HOME/.claude/model-tracking.json"
if [ -f "$tracking_file" ]; then
  reason=$(jq -r '.reason // "default"' "$tracking_file" 2>/dev/null)
  agent=$(jq -r '.agent // null' "$tracking_file" 2>/dev/null)
  context=$(jq -r '.context // ""' "$tracking_file" 2>/dev/null)
else
  reason="default"
  agent="null"
  context=""
fi

# Format model display with reason badge
model=""
case "$reason" in
  "default")
    model="$active_model"
    ;;
  "escalation-complexity")
    model="${active_model} ↑ (complex)"
    ;;
  "escalation-high-complexity")
    model="${active_model} ↑↑ (hard)"
    ;;
  "plan-mode")
    model="${active_model} ⊙ (plan)"
    ;;
  "review-mode")
    model="${active_model} ◊ (review)"
    ;;
  "preprocessing-triage")
    model="${active_model} ⚙ (prep)"
    ;;
  "preprocessing-large-context")
    model="${active_model} ⚙ (preprocess)"
    ;;
  "research-mode")
    model="${active_model} 🔍 (research)"
    ;;
  "deploy-mode")
    model="${active_model} ⬆ (deploy)"
    ;;
  *)
    model="${active_model}"
    ;;
esac

# Add agent info if present
if [ "$agent" != "null" ] && [ -n "$agent" ]; then
  model="${model} [${agent}]"
fi

# Format context window size as e.g. "200k"
if [ -n "$ctx_size" ] && [ "$ctx_size" != "null" ]; then
  ctx_label=$(awk "BEGIN { printf \"%.0fk\", $ctx_size/1000 }")
else
  ctx_label=""
fi

# Build model segment
if [ -n "$model" ] && [ -n "$ctx_label" ]; then
  model_seg="$model ($ctx_label)"
elif [ -n "$model" ]; then
  model_seg="$model"
else
  model_seg=""
fi

# Build context usage segment with 7-block progress bar (green filled blocks)
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

# Build clickable hyperlink for the folder name (OSC 8, opens in Finder via file:// URI)
# \033[1m = bold, \033[38;5;61m = muted slate-purple, \033[0m = reset; hover underline provided by terminal OSC 8
if [ -n "$dir_full" ] && [ "$dir_full" != "null" ]; then
  dir_link=$(printf '\033]8;;file://%s\033\\\033[1m\033[38;5;61m%s\033[0m\033]8;;\033\\' "$dir_full" "$dir")
else
  dir_link="$dir"
fi

# Assemble output
parts=""
[ -n "$dir_link" ]  && parts="$dir_link"
[ -n "$model_seg" ] && parts="$parts  |  $model_seg"
[ -n "$ctx_seg" ]  && parts="$parts  |  $ctx_seg"

printf "%b" "$parts"
