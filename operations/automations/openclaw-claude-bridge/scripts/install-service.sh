#!/usr/bin/env bash
# Installs the bridge as a macOS launchd service.
# Runs automatically on login, restarts on crash, no terminal needed.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/.."
PLIST_NAME="com.office.openclaw-claude-bridge"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs/openclaw-claude-bridge"

# Require .env to exist before installing
if [ ! -f "$BRIDGE_DIR/.env" ]; then
  echo "⚠️  No .env found in $BRIDGE_DIR"
  echo "   cp .env.example .env — then fill in BRIDGE_SECRET and OPENCLAW_BEARER_TOKEN"
  exit 1
fi

# Build production JS first
echo "▶ Building TypeScript..."
cd "$BRIDGE_DIR"
npx tsc

# Create log directory
mkdir -p "$LOG_DIR"

# Find node binary (handles nvm)
NODE_BIN="$(which node)"
if [ -z "$NODE_BIN" ]; then
  echo "✗ node not found in PATH"
  exit 1
fi

echo "▶ Using node: $NODE_BIN"

# Find claude binary (may be in ~/.local/bin which launchd won't see)
CLAUDE_BIN="$(which claude 2>/dev/null || echo "")"
NODE_DIR="$(dirname "$NODE_BIN")"
CLAUDE_DIR="$(dirname "$CLAUDE_BIN" 2>/dev/null || echo "")"

# Build a PATH that covers brew, nvm node, and claude locations
FULL_PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$NODE_DIR"
if [ -n "$CLAUDE_DIR" ] && [ "$CLAUDE_DIR" != "." ]; then
  FULL_PATH="$FULL_PATH:$CLAUDE_DIR"
fi

echo "▶ Claude binary: ${CLAUDE_BIN:-not found in PATH}"
echo "▶ Service PATH: $FULL_PATH"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_NAME</string>

  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$BRIDGE_DIR/dist/index.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$BRIDGE_DIR</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$FULL_PATH</string>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/bridge.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/bridge.error.log</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
EOF

echo "▶ Installing service to $PLIST_PATH"

# Unload if already running
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# Load the service
launchctl load "$PLIST_PATH"

echo ""
echo "✅ Bridge service installed and started."
echo ""
echo "   Status:  launchctl list | grep openclaw"
echo "   Logs:    tail -f $LOG_DIR/bridge.log"
echo "   Errors:  tail -f $LOG_DIR/bridge.error.log"
echo "   Stop:    launchctl unload $PLIST_PATH"
echo "   Restart: launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH"
echo ""
echo "   The bridge will now start automatically on every login."
