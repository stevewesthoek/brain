#!/bin/bash

# Firecrawl Local Wrapper - Auto-shutdown after 15min idle
# Routes all requests through localhost:3051
# All requests logged and parameter-validated

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/firecrawl.log"
LASTACCESS_FILE="${SCRIPT_DIR}/.lastaccess"

FIRECRAWL_URL="http://localhost:3051"

# Hard caps
MAX_PAGES_HARD_CAP=50
MAX_DEPTH_HARD_CAP=3
TIMEOUT_HARD_CAP=120

# Safe defaults
DEFAULT_MAX_PAGES=25
DEFAULT_MAX_DEPTH=2
REQUEST_TIMEOUT=60

# Idle timeout: 15 minutes
IDLE_TIMEOUT_MIN=15
IDLE_TIMEOUT_SEC=$((IDLE_TIMEOUT_MIN * 60))

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log_request() {
    local url="$1" mode="$2" max_pages="$3" max_depth="$4" timeout="$5" proxy="${6:-none}" status="${7:-pending}"
    log "REQUEST | URL: $url | MODE: $mode | MAX_PAGES: $max_pages | MAX_DEPTH: $max_depth | TIMEOUT: $timeout | PROXY: $proxy | STATUS: $status"
}

update_last_access() {
    echo "$(date +%s)" > "$LASTACCESS_FILE"
}

is_running() {
    curl -sf "${FIRECRAWL_URL}/v1/crawl" -X POST -H 'Content-Type: application/json' -d '{"url":"http://localhost"}' > /dev/null 2>&1 || curl -sf "http://localhost:3051" > /dev/null 2>&1
}

check_idle_shutdown() {
    if [ ! -f "$LASTACCESS_FILE" ]; then
        return 0
    fi

    local last_access=$(cat "$LASTACCESS_FILE")
    local current_time=$(date +%s)
    local elapsed=$((current_time - last_access))

    if [ $elapsed -gt $IDLE_TIMEOUT_SEC ]; then
        log "Idle timeout reached after ${IDLE_TIMEOUT_MIN} minutes - shutting down"
        cd "$SCRIPT_DIR"
        docker compose down > /dev/null 2>&1 || true
        rm -f "$LASTACCESS_FILE"
        return 1
    fi
    return 0
}

validate_params() {
    local mode="$1" url="$2" max_pages="${3:-$DEFAULT_MAX_PAGES}" max_depth="${4:-$DEFAULT_MAX_DEPTH}" timeout="${5:-$REQUEST_TIMEOUT}" deep_mode="${6:-false}"

    [[ ! "$url" =~ ^https?:// ]] && { echo "ERROR: Invalid URL format" >&2; return 1; }

    [ "$deep_mode" = "true" ] && { max_pages=100; max_depth=3; }

    max_pages=$(( max_pages > MAX_PAGES_HARD_CAP ? MAX_PAGES_HARD_CAP : max_pages ))
    max_depth=$(( max_depth > MAX_DEPTH_HARD_CAP ? MAX_DEPTH_HARD_CAP : max_depth ))
    timeout=$(( timeout > TIMEOUT_HARD_CAP ? TIMEOUT_HARD_CAP : timeout ))

    echo "$max_pages:$max_depth:$timeout"
}

execute_request() {
    local url="$1" mode="$2" max_pages="${3:-$DEFAULT_MAX_PAGES}" max_depth="${4:-$DEFAULT_MAX_DEPTH}" timeout="${5:-$REQUEST_TIMEOUT}" proxy="${6:-}" deep_mode="${7:-false}"

    local validated
    validated=$(validate_params "$mode" "$url" "$max_pages" "$max_depth" "$timeout" "$deep_mode") || {
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "validation_failed"
        return 1
    }

    IFS=':' read -r max_pages max_depth timeout <<< "$validated"

    if ! check_idle_shutdown; then
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "failed_idle_shutdown"
        echo "ERROR: Firecrawl was idle and shut down" >&2
        return 1
    fi

    if ! is_running; then
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "failed_health_check"
        echo "ERROR: Firecrawl is not responding" >&2
        return 1
    fi

    local payload
    case "$mode" in
        scrape) payload="{\"url\": \"$url\", \"formats\": [\"markdown\"]}" ;;
        crawl) payload="{\"url\": \"$url\", \"limit\": $max_pages, \"scrapeOptions\": {\"formats\": [\"markdown\"]}}" ;;
        map) payload="{\"url\": \"$url\"}" ;;
        *) log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "invalid_mode"; echo "ERROR: Unknown mode: $mode" >&2; return 1 ;;
    esac

    log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "executing"

    local response
    response=$(curl -s -X POST "${FIRECRAWL_URL}/v1/$mode" \
        -H 'Content-Type: application/json' \
        -d "$payload" \
        --max-time "$((timeout + 10))" 2>&1) || {
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "request_timeout"
        echo "ERROR: Timeout after ${timeout}s" >&2
        return 1
    }

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "success"
        update_last_access
        echo "$response"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error // .message // "Unknown error"' 2>/dev/null)
        log_request "$url" "$mode" "$max_pages" "$max_depth" "$timeout" "$proxy" "failed: $error_msg"
        echo "ERROR: $error_msg" >&2
        return 1
    fi
}

main() {
    local cmd="${1:-help}"
    case "$cmd" in
        health)
            if is_running && check_idle_shutdown; then
                echo "✅ Firecrawl healthy"
                log "Health check: OK"
                update_last_access
                return 0
            else
                echo "❌ Firecrawl not responding or idle shutdown triggered"
                log "Health check: FAILED"
                return 1
            fi
            ;;
        logs)
            [ -f "$LOG_FILE" ] && tail -f "$LOG_FILE" || echo "No logs yet"
            ;;
        scrape)
            [ $# -lt 2 ] && { echo "Usage: $0 scrape <url> [timeout]" >&2; return 1; }
            execute_request "$2" "scrape" "" "" "${3:-$REQUEST_TIMEOUT}" "" "false"
            ;;
        crawl)
            [ $# -lt 2 ] && { echo "Usage: $0 crawl <url> [pages] [depth] [timeout] [--deep]" >&2; return 1; }
            local deep="false"
            [ $# -gt 5 ] && [ "$6" = "--deep" ] && deep="true"
            execute_request "$2" "crawl" "${3:-$DEFAULT_MAX_PAGES}" "${4:-$DEFAULT_MAX_DEPTH}" "${5:-$REQUEST_TIMEOUT}" "" "$deep"
            ;;
        map)
            [ $# -lt 2 ] && { echo "Usage: $0 map <url> [timeout]" >&2; return 1; }
            execute_request "$2" "map" "" "" "${3:-$REQUEST_TIMEOUT}" "" "false"
            ;;
        *)
            cat <<'EOF'
Firecrawl Wrapper - Local on-demand with 15-minute idle shutdown

Usage:
  firecrawl-wrapper.sh health                         Check health (updates idle timer)
  firecrawl-wrapper.sh logs                           Tail request logs
  firecrawl-wrapper.sh scrape <url> [timeout]         Scrape one URL to markdown
  firecrawl-wrapper.sh crawl <url> [pages] [depth] [timeout] [--deep]  Crawl site
  firecrawl-wrapper.sh map <url> [timeout]            Map site structure

Examples:
  firecrawl-wrapper.sh scrape https://example.com
  firecrawl-wrapper.sh crawl https://example.com 10 2 60
  firecrawl-wrapper.sh crawl https://example.com --deep

Hard caps (enforced):
  - Max pages: 50
  - Max depth: 3
  - Max timeout: 120s

Safe defaults:
  - Pages: 25
  - Depth: 2
  - Timeout: 60s

Idle shutdown:
  - Firecrawl automatically stops after 15 minutes of inactivity
  - Logs: ~/tools/firecrawl/logs/firecrawl.log
EOF
            ;;
    esac
}

main "$@"
