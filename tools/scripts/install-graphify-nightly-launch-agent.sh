#!/usr/bin/env bash
set -euo pipefail

LABEL="com.office.graphify-nightly"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
BRAIN_REPO="${BRAIN_REPO:-/Users/Office/Repos/stevewesthoek/brain}"
SCRIPT="$BRAIN_REPO/tools/scripts/graphify-nightly.sh"
LOG_DIR="$HOME/Library/Logs/graphify-nightly"
STDOUT_LOG="$LOG_DIR/stdout.log"
STDERR_LOG="$LOG_DIR/stderr.log"
START_HOUR="${GRAPHIFY_START_HOUR:-1}"
START_MINUTE="${GRAPHIFY_START_MINUTE:-15}"

if [[ ! -x "$SCRIPT" ]]; then
  echo "Missing executable scheduler script: $SCRIPT" >&2
  echo "Run: chmod +x $SCRIPT" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${SCRIPT}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${BRAIN_REPO}</string>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${START_HOUR}</integer>
    <key>Minute</key>
    <integer>${START_MINUTE}</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>${STDOUT_LOG}</string>

  <key>StandardErrorPath</key>
  <string>${STDERR_LOG}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin</string>
    <key>GRAPHIFY_REPO_ROOTS</key>
    <string>/Users/Office/Repos</string>
    <key>GRAPHIFY_PHASES</key>
    <string>1 2 3 4</string>
    <key>GRAPHIFY_BACKEND</key>
    <string>ollama</string>
    <key>GRAPHIFY_MODEL</key>
    <string>gemma4:12b-mlx</string>
    <key>OLLAMA_API_KEY</key>
    <string>ollama</string>
    <key>GRAPHIFY_OLLAMA_NUM_CTX</key>
    <string>8192</string>
    <key>GRAPHIFY_OLLAMA_KEEP_ALIVE</key>
    <string>30</string>
    <key>GRAPHIFY_MAX_CONCURRENCY</key>
    <string>1</string>
    <key>GRAPHIFY_API_TIMEOUT</key>
    <string>900</string>
    <key>GRAPHIFY_VIZ_NODE_LIMIT</key>
    <string>30000</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}"

printf 'Installed %s\n' "$PLIST"
printf 'Runs daily at %02d:%02d local time.\n' "$START_HOUR" "$START_MINUTE"
printf 'Logs:\n  %s\n  %s\n' "$STDOUT_LOG" "$STDERR_LOG"
launchctl print "gui/$(id -u)/${LABEL}" | sed -n '1,80p'
