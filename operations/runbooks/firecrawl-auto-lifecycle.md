# FireCrawl Auto-Lifecycle Management

## Overview

FireCrawl now has **automatic startup and shutdown** that requires zero manual intervention. When you invoke `firecrawl` from CLI or IDE plugins, the system automatically:

1. **Checks OrbStack** — starts if not running
2. **Checks Docker** — restarts containers if down
3. **Waits for ready** — polls until API responds (up to 60s)
4. **Executes request** — your scrape/crawl operation
5. **Logs activity** — records request to idle-timer
6. **Auto-shutdown** — background daemon shuts down after 15 minutes of inactivity

## Installation Status

✅ **All components installed and active:**

| Component | Status | Location |
|-----------|--------|----------|
| Enhanced wrapper | ✅ Active | `brain/tools/firecrawl/firecrawl-wrapper.sh` |
| OrbStack auto-start | ✅ Enabled | In wrapper (requires `orb` CLI) |
| Container auto-start | ✅ Enabled | In wrapper (docker compose up) |
| Idle daemon | ✅ Running | `com.office.firecrawl-idle-daemon` |
| Daemon plist | ✅ Loaded | `~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist` |
| Status script | ✅ Available | `firecrawl-status` in `~/.local/bin/` |

## How It Works

### When You Call `firecrawl scrape <url>`

```
┌─────────────────────────────────────────────┐
│ 1. Wrapper starts                           │
│    - Checks OrbStack via 'orb' CLI          │
│    - If not running: orb start (or fallback)│
│    - Waits 5 seconds                        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 2. Checks Docker containers                 │
│    - Runs: is_running() health check        │
│    - If down: docker compose up -d          │
│    - Waits up to 60 seconds for API ready   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 3. Executes request                         │
│    - Sends curl to http://localhost:3055    │
│    - Returns JSON with markdown content     │
│    - Logs request to firecrawl.log          │
│    - Updates .lastaccess timestamp          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 4. Daemon monitors idle timer               │
│    - Background process checks every 30s    │
│    - Reads .lastaccess timestamp            │
│    - After 15 min inactivity:               │
│      docker compose down                    │
│      rm .lastaccess                         │
│    - Shuts down OrbStack too (optional)     │
└─────────────────────────────────────────────┘
```

## Usage Examples

### From CLI (Claude Code, Codex, Gemini CLI)

```bash
# This works automatically — no setup needed
firecrawl health
firecrawl scrape https://example.com
firecrawl crawl https://example.com 10 2 60
```

### From IDE Plugins (Kiro, Cursor, anti-gravity)

```bash
# Same as CLI — use absolute path
/Users/Office/.local/bin/firecrawl health
/Users/Office/.local/bin/firecrawl scrape https://example.com
```

### Check Status

```bash
# Full infrastructure report
firecrawl-status

# View live logs
firecrawl logs

# Watch for idle shutdown (30s intervals)
tail -f brain/tools/firecrawl/logs/firecrawl.log
tail -f brain/tools/firecrawl/logs/daemon-stdout.log
```

## Important Files

| File | Purpose | Path |
|------|---------|------|
| Wrapper script | Auto-startup logic | `brain/tools/firecrawl/firecrawl-wrapper.sh` |
| Idle daemon | Auto-shutdown service | `brain/tools/firecrawl/firecrawl-idle-daemon.sh` |
| Daemon plist | LaunchAgent configuration | `~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist` |
| Main log | Request/startup logs | `brain/tools/firecrawl/logs/firecrawl.log` |
| Daemon log | Daemon activity logs | `brain/tools/firecrawl/logs/daemon-stdout.log` |
| Last access | Idle timer file | `brain/tools/firecrawl/.lastaccess` |
| Status script | Infrastructure report | `brain/tools/firecrawl/firecrawl-status.sh` |

## Daemon Management

### Check Daemon Status

```bash
launchctl list com.office.firecrawl-idle-daemon
# Shows: PID and error code (0 = healthy)
```

### Restart Daemon

```bash
launchctl restart com.office.firecrawl-idle-daemon
```

### Stop Daemon (temporary)

```bash
launchctl stop com.office.firecrawl-idle-daemon
```

### Disable Daemon Permanently

```bash
launchctl unload ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist
```

### Re-enable Daemon

```bash
launchctl load ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist
```

### View Daemon Logs

```bash
# stdout
tail -f brain/tools/firecrawl/logs/daemon-stdout.log

# stderr
tail -f brain/tools/firecrawl/logs/daemon-stderr.log

# Main request log
tail -f brain/tools/firecrawl/logs/firecrawl.log | grep DAEMON
```

## Troubleshooting

### "Firecrawl not responding" (should never happen now)

1. Check OrbStack: `orb status`
2. Check Docker: `docker ps`
3. Check daemon: `launchctl list com.office.firecrawl-idle-daemon`
4. Full report: `firecrawl-status`
5. Restart daemon: `launchctl restart com.office.firecrawl-idle-daemon`

### Daemon not running

```bash
# Check if loaded
launchctl list | grep firecrawl-idle-daemon

# Reload
launchctl unload ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist
launchctl load ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist

# Verify
launchctl list com.office.firecrawl-idle-daemon
```

### Containers not auto-starting

1. Try manual: `firecrawl health`
2. Check logs: `firecrawl logs`
3. Check OrbStack: `orb status` or `open -a OrbStack`
4. Check Docker: `docker ps` (should show firecrawl containers)

### Containers not auto-shutting down

1. Verify daemon is running: `launchctl list com.office.firecrawl-idle-daemon`
2. Check last access: `cat brain/tools/firecrawl/.lastaccess`
3. Check daemon logs: `tail -f brain/tools/firecrawl/logs/daemon-stdout.log`
4. Manual shutdown: `cd brain/tools/firecrawl && docker compose down`

## Configuration

### Idle Timeout

- **Current:** 15 minutes (900 seconds)
- **To change:** Edit wrapper and daemon scripts
  - Wrapper: Line 27 `IDLE_TIMEOUT_SEC`
  - Daemon: Line 14 `IDLE_TIMEOUT_SEC`

### Startup Timeout

- **Current:** 60 seconds (max wait for Firecrawl to respond)
- **To change:** Edit wrapper line 11 `STARTUP_TIMEOUT`

### Daemon Check Interval

- **Current:** 30 seconds (check for idle every 30s)
- **To change:** Edit daemon line 16 `CHECK_INTERVAL`

## Integration Points

### Claude Code / Codex / Gemini CLI

- Use: `firecrawl <command>`
- Auto-startup: ✅ Yes
- Auto-shutdown: ✅ Yes (via daemon)

### IDE Plugins (Kiro, Cursor, anti-gravity)

- Use: `/Users/Office/.local/bin/firecrawl <command>`
- Auto-startup: ✅ Yes
- Auto-shutdown: ✅ Yes (via daemon)

### Scripts / Automation

- Use: `brain/tools/firecrawl/firecrawl-wrapper.sh <command>`
- Auto-startup: ✅ Yes
- Auto-shutdown: ✅ Yes (via daemon)

## Cost & Token Impact

- **Zero additional overhead** — same token cost as before
- **Network efficiency:** Auto-startup is local, ~100ms delay on cold start
- **Resource efficiency:** Daemon auto-stops to free memory/CPU after 15 min
- **No MCP servers** — direct CLI invocation keeps context lean

## See Also

- FireCrawl skill: `brain/ai/skills/active/firecrawl/SKILL.md`
- IDE integration: `brain/operations/runbooks/firecrawl-ide-integration.md`
- Wrapper reference: `brain/tools/firecrawl/firecrawl-wrapper.sh`
