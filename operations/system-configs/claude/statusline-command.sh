#!/bin/sh
input=$(cat)
dir_full=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$dir_full")
model=$(echo "$input" | jq -r '.model.display_name // ""')
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // ""')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

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
