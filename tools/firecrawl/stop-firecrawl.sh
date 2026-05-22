#!/bin/bash

# Firecrawl unified stop script
# Stops the Docker Compose stack and leaves the idle daemon free to restart it later if needed.

set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/firecrawl-stop.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Stopping Firecrawl containers..."
cd "$SCRIPT_DIR"
if docker compose down > /dev/null 2>&1; then
  log "Containers stopped"
else
  log "WARNING: docker compose down failed"
fi

log "Firecrawl stop sequence complete"
