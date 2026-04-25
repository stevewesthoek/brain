#!/bin/bash

# Firecrawl Status Report
# Shows comprehensive status of Firecrawl, OrbStack, and daemon

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/firecrawl.log"

echo "═══════════════════════════════════════════════════════════════"
echo "FireCrawl Infrastructure Status"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "1. OrbStack Status:"
if command -v orb &> /dev/null; then
    if orb status > /dev/null 2>&1; then
        echo "   ✅ OrbStack running"
    else
        echo "   ⚠️  OrbStack NOT running (app may still be runnable)"
    fi
else
    echo "   ⚠️  OrbStack CLI not found"
fi
echo ""

echo "2. Docker Daemon:"
if docker ps > /dev/null 2>&1; then
    echo "   ✅ Docker is accessible"
    docker ps --filter "name=firecrawl" --format "table {{.Names}}\t{{.Status}}" | head -10
else
    echo "   ❌ Docker not accessible"
fi
echo ""

echo "3. Firecrawl Containers:"
cd "$SCRIPT_DIR"
if docker compose ps 2>/dev/null | grep -q "firecrawl"; then
    echo "   ✅ Firecrawl containers running:"
    docker compose ps --format "table {{.Service}}\t{{.Status}}"
else
    echo "   ⚠️  Firecrawl containers NOT running (will auto-start on use)"
fi
echo ""

echo "4. Firecrawl Health Check:"
if curl -sf "http://localhost:3055" > /dev/null 2>&1; then
    echo "   ✅ Firecrawl API responding at http://localhost:3055"
else
    echo "   ⚠️  Firecrawl not responding (will auto-start on use)"
fi
echo ""

echo "5. Idle Daemon:"
if launchctl list | grep -q "com.office.firecrawl-idle-daemon"; then
    echo "   ✅ Firecrawl Idle Daemon is loaded"
    echo "   Status: $(launchctl list com.office.firecrawl-idle-daemon 2>/dev/null | awk '{print $1}' | grep -q '^-' && echo 'Active' || echo 'Inactive/Errored')"
else
    echo "   ⚠️  Firecrawl Idle Daemon not loaded"
fi
echo ""

echo "6. Log Files:"
if [ -f "$LOG_FILE" ]; then
    echo "   Main log: $LOG_FILE"
    echo "   Size: $(du -h "$LOG_FILE" | cut -f1)"
    echo "   Last 5 entries:"
    tail -5 "$LOG_FILE" | sed 's/^/     /'
else
    echo "   ⚠️  No log file yet"
fi
echo ""

echo "7. Daemon Logs:"
if [ -f "${SCRIPT_DIR}/logs/daemon-stdout.log" ]; then
    echo "   Daemon stdout (last 3 lines):"
    tail -3 "${SCRIPT_DIR}/logs/daemon-stdout.log" | sed 's/^/     /'
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "Quick Actions:"
echo "═══════════════════════════════════════════════════════════════"
echo "Start Firecrawl:    firecrawl health"
echo "Run a scrape:       firecrawl scrape https://example.com"
echo "View live logs:     firecrawl logs"
echo "Restart daemon:     launchctl restart com.office.firecrawl-idle-daemon"
echo "Stop daemon:        launchctl unload ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist"
echo "Stop containers:    cd $SCRIPT_DIR && docker compose down"
echo ""
