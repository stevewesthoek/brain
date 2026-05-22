#!/bin/bash

# Firecrawl Idle Daemon
# Monitors Firecrawl activity and auto-shuts down after 15 minutes of inactivity
# Run this as a background service (e.g., via launchd)

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/firecrawl.log"
LASTACCESS_FILE="${SCRIPT_DIR}/.lastaccess"

FIRECRAWL_URL="http://localhost:3055"
IDLE_TIMEOUT_MIN=15
IDLE_TIMEOUT_SEC=$((IDLE_TIMEOUT_MIN * 60))
CHECK_INTERVAL=30  # Check every 30 seconds

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DAEMON] $*" >> "$LOG_FILE"
}

is_running() {
    curl -sf "${FIRECRAWL_URL}/v1/crawl" -X POST -H 'Content-Type: application/json' -d '{"url":"http://localhost"}' > /dev/null 2>&1 || curl -sf "http://localhost:3055" > /dev/null 2>&1
}

shutdown_firecrawl() {
    log "Idle timeout reached (${IDLE_TIMEOUT_MIN} min) - shutting down containers"
    cd "$SCRIPT_DIR"
    docker compose down > /dev/null 2>&1 || log "WARNING: docker compose down failed"
    rm -f "$LASTACCESS_FILE"
    log "Containers shut down"
}

main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    log "Firecrawl Idle Daemon started (checking every ${CHECK_INTERVAL}s, timeout: ${IDLE_TIMEOUT_MIN}min)"

    while true; do
        sleep "$CHECK_INTERVAL"

        # Check if containers are running
        if ! is_running; then
            # Containers not running, nothing to do
            continue
        fi

        # Check idle timeout
        if [ ! -f "$LASTACCESS_FILE" ]; then
            # No last access recorded, assume fresh start
            continue
        fi

        local last_access=$(cat "$LASTACCESS_FILE")
        local current_time=$(date +%s)
        local elapsed=$((current_time - last_access))

        if [ $elapsed -gt $IDLE_TIMEOUT_SEC ]; then
            shutdown_firecrawl
        fi
    done
}

main "$@"
