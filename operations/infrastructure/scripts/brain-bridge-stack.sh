#!/bin/bash

set -e

BUILDFLOW_DIR="${BUILDFLOW_DIR:-/Users/Office/Repos/stevewesthoek/buildflow}"
VAULT_DIR="${VAULT_DIR:-/Users/Office/Repos/stevewesthoek/brain}"
LOG_DIR="/tmp"

# Load token from local config if not already set
if [ -z "$BUILDFLOW_ACTION_TOKEN" ] && [ -f "$HOME/.config/buildflow/.env" ]; then
  export $(grep BUILDFLOW_ACTION_TOKEN "$HOME/.config/buildflow/.env" | xargs)
fi

RELAY_LOG="$LOG_DIR/buildflow-bridge.log"
AGENT_LOG="$LOG_DIR/buildflow-agent.log"
WEB_LOG="$LOG_DIR/buildflow-web.log"

RELAY_PORT=3053
AGENT_PORT=3052
WEB_PORT=3054

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[BuildFlow]${NC} $1"
}

error() {
  echo -e "${RED}[BuildFlow Error]${NC} $1" >&2
}

warn() {
  echo -e "${YELLOW}[BuildFlow]${NC} $1"
}

check_port() {
  lsof -i :$1 > /dev/null 2>&1
}

kill_port() {
  if check_port $1; then
    log "Killing process on port $1..."
    lsof -ti :$1 | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

start() {
  log "Starting BuildFlow stack..."

  # Safety: kill any existing processes
  kill_port $RELAY_PORT
  kill_port $AGENT_PORT
  kill_port $WEB_PORT

  # Start relay first
  log "Starting relay on port $RELAY_PORT..."
  cd "$BUILDFLOW_DIR/packages/bridge"
  node dist/server.js > "$RELAY_LOG" 2>&1 &
  RELAY_PID=$!
  log "Relay started (PID: $RELAY_PID)"
  sleep 2

  # Wait for relay to be ready
  local relay_ready=0
  for i in {1..10}; do
    if check_port $RELAY_PORT; then
      relay_ready=1
      break
    fi
    sleep 0.5
  done

  if [ $relay_ready -eq 0 ]; then
    error "Relay failed to start on port $RELAY_PORT"
    return 1
  fi

  log "Relay is ready"

  # Connect and index vault
  log "Connecting vault at $VAULT_DIR..."
  cd "$BUILDFLOW_DIR"
  node packages/cli/dist/index.js connect "$VAULT_DIR" >> "$AGENT_LOG" 2>&1 || true

  log "Indexing vault..."
  node packages/cli/dist/index.js index >> "$AGENT_LOG" 2>&1 || true

  # Start local agent
  log "Starting local agent on port $AGENT_PORT..."
  export BRIDGE_URL="ws://127.0.0.1:$RELAY_PORT"
  export DEVICE_TOKEN="local-agent"
  node packages/cli/dist/index.js serve > "$AGENT_LOG" 2>&1 &
  AGENT_PID=$!
  log "Agent started (PID: $AGENT_PID)"
  sleep 2

  # Start web app
  log "Starting web app on port $WEB_PORT..."
  cd "$BUILDFLOW_DIR/apps/web"
  if [ -n "$BUILDFLOW_ACTION_TOKEN" ]; then
    export BUILDFLOW_ACTION_TOKEN="$BUILDFLOW_ACTION_TOKEN"
  fi
  npm run dev > "$WEB_LOG" 2>&1 &
  WEB_PID=$!
  log "Web app started (PID: $WEB_PID)"
  sleep 3

  log "All BuildFlow components started"
  log "Logs:"
  log "  Relay:  $RELAY_LOG"
  log "  Agent:  $AGENT_LOG"
  log "  Web:    $WEB_LOG"
}

stop() {
  log "Stopping BuildFlow stack..."

  kill_port $WEB_PORT
  kill_port $AGENT_PORT
  kill_port $RELAY_PORT

  log "All BuildFlow components stopped"
}

status() {
  log "Checking BuildFlow stack status..."
  local all_healthy=1

  # Check relay
  if check_port $RELAY_PORT; then
    log "✓ Relay is running on port $RELAY_PORT"
  else
    error "✗ Relay is NOT running on port $RELAY_PORT"
    all_healthy=0
  fi

  # Check agent
  if check_port $AGENT_PORT; then
    log "✓ Agent is running on port $AGENT_PORT"
  else
    error "✗ Agent is NOT running on port $AGENT_PORT"
    all_healthy=0
  fi

  # Check web
  if check_port $WEB_PORT; then
    log "✓ Web app is running on port $WEB_PORT"
  else
    error "✗ Web app is NOT running on port $WEB_PORT"
    all_healthy=0
  fi

  # Try HTTP checks
  if curl -s http://127.0.0.1:$WEB_PORT/api/openapi > /dev/null 2>&1; then
    log "✓ Web app OpenAPI is responding"
  else
    warn "⚠ Web app OpenAPI check failed (may still be starting)"
    all_healthy=0
  fi

  if [ $all_healthy -eq 1 ]; then
    log "All components healthy"
    return 0
  else
    return 1
  fi
}

case "${1:-status}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  restart)
    stop
    sleep 1
    start
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
