#!/usr/bin/env bash
# qwen-service — manage the general-purpose QWEN Ollama instance
# Runs on port 11435 (separate from default 11434)
# Usage:
#   qwen-service start   — start the QWEN instance
#   qwen-service stop    — stop the QWEN instance
#   qwen-service status  — check if running
#   qwen-service pull    — pull qwen2.5-coder:14b model

OLLAMA_HOST="127.0.0.1:11435"
OLLAMA_MODELS_DIR="$HOME/.ollama-qwen"
LOG_FILE="$HOME/.ollama-qwen/qwen.log"
OLLAMA_BIN="/opt/homebrew/opt/ollama/bin/ollama"

mkdir -p "$OLLAMA_MODELS_DIR"

start_qwen() {
  if curl -s "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    echo "✓ QWEN instance already running on $OLLAMA_HOST"
    return 0
  fi

  echo "Starting QWEN Ollama instance on $OLLAMA_HOST..."
  OLLAMA_HOST="$OLLAMA_HOST" \
  OLLAMA_MODELS="$OLLAMA_MODELS_DIR" \
  OLLAMA_FLASH_ATTENTION="1" \
  OLLAMA_KV_CACHE_TYPE="q8_0" \
  "$OLLAMA_BIN" serve >> "$LOG_FILE" 2>&1 &

  # Wait for service to be ready
  local max_attempts=30
  local attempt=0
  while ! curl -s "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
      echo "✗ Failed to start QWEN instance" >&2
      return 1
    fi
    sleep 1
  done

  echo "✓ QWEN instance started on $OLLAMA_HOST"
}

stop_qwen() {
  if ! curl -s "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    echo "✓ QWEN instance not running"
    return 0
  fi

  echo "Stopping QWEN Ollama instance..."
  pkill -f "OLLAMA_HOST=$OLLAMA_HOST" || true
  sleep 2

  if curl -s "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    echo "✗ Failed to stop QWEN instance" >&2
    return 1
  fi

  echo "✓ QWEN instance stopped"
}

status_qwen() {
  if curl -s "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    echo "✓ QWEN instance running on $OLLAMA_HOST"
    curl -s "http://$OLLAMA_HOST/api/tags" | jq '.models[].name' 2>/dev/null || echo "  (unable to list models)"
  else
    echo "✗ QWEN instance not running"
    return 1
  fi
}

pull_qwen() {
  echo "Pulling qwen2.5-coder:14b model..."
  curl -X POST "http://$OLLAMA_HOST/api/pull" \
    -H "Content-Type: application/json" \
    -d '{"name": "qwen2.5-coder:14b"}' \
    --progress-bar \
    --fail || {
    echo "✗ Failed to pull model. Is QWEN instance running?" >&2
    return 1
  }
  echo "✓ Model pulled successfully"
}

case "${1:-status}" in
  start)
    start_qwen
    ;;
  stop)
    stop_qwen
    ;;
  status)
    status_qwen
    ;;
  pull)
    pull_qwen
    ;;
  *)
    echo "Usage: qwen-service {start|stop|status|pull}"
    exit 1
    ;;
esac
