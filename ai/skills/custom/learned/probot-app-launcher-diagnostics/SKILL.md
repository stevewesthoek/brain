---
name: probot-app-launcher-diagnostics
description: When ProBot's start/restart button shows "initiated" but services don't start, diagnose silent failures in the detached app launcher.
---

# ProBot App Launcher Diagnostics

## The insight

ProBot launches local apps (BuildFlow, Firecrawl, etc.) in **detached mode with `stdio: "ignore"`** (see `local-apps.ts:150-156`). This means:
- Child process runs independently
- All output (stdout/stderr) is discarded
- Errors are completely invisible to the dashboard
- Dashboard shows "Start initiated" regardless of whether the process actually started

When a start command fails due to missing prerequisites (OrbStack down, Docker not responding, missing env vars), you see only silence.

## When this applies

**Symptoms:**
- ProBot dashboard shows "Start initiated" but service doesn't start
- Dashboard doesn't show an error message
- Service status stays "stopped" or bounces to "starting" then back to "stopped"
- Works from command line but not from dashboard

**Common causes:**
- OrbStack/Docker daemon not running (affects BuildFlow, Firecrawl, any Docker-dependent app)
- Missing environment file (e.g., `~/.config/buildflow/.env.relay`)
- Shell script prerequisites not met (e.g., `pnpm` not installed)
- Port already in use but start script doesn't handle graceful restart

## The approach

**Quick diagnosis sequence:**

1. **Check if OrbStack is running** — most common cause for BuildFlow:
   ```bash
   orbctl status  # or just try: docker ps
   ```

2. **Run the orchestrator manually** to see the actual error:
   ```bash
   cd ~/Repos/stevewesthoek/buildflow
   bash buildflow-orchestrator.sh start  # actual error output visible here (production-grade)
   ```

3. **Check the logs** ProBot wrote (if any):
   ```bash
   tail -50 /tmp/buildflow-cli.log
   tail -50 /tmp/buildflow-web.log
   tail -50 /tmp/probot.log
   ```

4. **Check running processes** to see if the command even spawned:
   ```bash
   ps aux | grep -E "pnpm|node" | grep -v grep
   ```

## The fix

**For BuildFlow specifically:**
```bash
orbctl start  # Start OrbStack if not running
# Then use ProBot dashboard or: cd ~/Repos/stevewesthoek/buildflow && ./buildflow-orchestrator.sh start
```

**For any local app:**
1. Identify the prerequisite (Docker, environment file, etc.)
2. Verify it's available: `which pnpm`, `docker ps`, `cat ~/.config/app/.env`, etc.
3. Run the start script manually from the repo directory
4. Once manual start works, ProBot dashboard start should work too

## Gotchas

- **ProBot rebuilds are silent too** — if you update ProBot code and restart, errors in `npm build` or `npm start` won't show in the dashboard. Check `/tmp/probot.log`.
- **Port conflicts aren't shown** — if a previous instance is still running, the start script might succeed (detached) but the new process fails to bind. Check `lsof -i :3052` etc.
- **Env file changes don't auto-reload** — if you edit `.env.local` in BuildFlow, you must manually restart (the start script picks up env at spawn time, not from running process).
- **Relay Docker container is separate** — BuildFlow's relay service (port 3053) runs in Docker. Docker compose failures are logged to `/tmp/buildflow-relay.log`, not stdout.

## Context

Repo: stevewesthoek/brain (ProBot + BuildFlow)  
Discovered: 2026-04-26  
Area: `projects/probot/src/bot/{local-apps.ts, dashboard.ts}` and `buildflow/buildflow-orchestrator.sh`  
Trigger: Node 14.1 update exposed the issue after native module rebuild
