---
name: docker-desktop-broken-symlink-crash-loop
description: DEPRECATED (2026-04-19). Docker Desktop is no longer used. The machine now runs OrbStack for local containers. This skill is kept for reference only.
---

# Docker Desktop Broken Symlink Crash Loop (DEPRECATED)

**⚠️ This skill is obsolete.** Docker Desktop has been replaced with OrbStack. See `/orbstack` skill instead.

## The insight
Docker Desktop's backend calls `mkdir ~/.docker` on every startup. Go's `os.MkdirAll`
returns "file exists" if the path is a symlink — even a broken one. This crashes the
backend immediately, which then auto-restarts, accumulates a lingering process, and loops.
The result looks like a memory leak but is actually unbounded crash cycling.

## When this applies
- Docker Desktop won't start / keeps showing "lingering processes detected"
- Memory climbs continuously while Docker processes appear and disappear
- Backend log contains:
  `mkdir <HOME>/.docker: file exists`
- `~/.docker` is part of brain's symlink map and the target directory was never created

## The approach
1. Check `~/.docker` with `file ~/.docker` — if it says "broken symbolic link", that's the cause
2. Confirm by reading `~/Library/Containers/com.docker.docker/Data/log/host/com.docker.backend.log`
   and searching for "mkdir" errors near startup
3. Do NOT assume memory usage or process count is the root cause — they're symptoms of the loop

## The fix
Create the missing target directory that the symlink points to:
```bash
mkdir -p ~/Repos/stevewesthoek/brain/operations/system-configs/docker
```
Docker Desktop will then create `config.json` and `cli-plugins/` inside it on first start.

## Gotchas
- `Docker.raw` VM disk image reports a huge logical size (926GB on a 926GB disk) but uses
  only ~19GB actual space — this is APFS sparse file behavior, not a problem.
- The "lingering processes" error Docker shows is a downstream effect of the crash loop, not
  the root cause.
- Add `~/.docker → operations/system-configs/docker/` to CLAUDE.md's symlink map so the
  directory is known to future sessions and won't be accidentally omitted.

## Context
Repo: brain (stevewesthoek)
Discovered: 2026-04-07
Area: operations/system-configs/docker, ~/.docker symlink
