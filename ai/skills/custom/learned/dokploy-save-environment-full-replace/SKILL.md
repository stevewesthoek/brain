---
name: dokploy-save-environment-full-replace
description: Use when writing env vars to a Dokploy app — the saveEnvironment API silently replaces the entire env string. A test write wipes all production secrets.
---

# Dokploy saveEnvironment Full Replace

## The insight
Dokploy's `saveEnvironment` API replaces the ENTIRE env string atomically. There is no merge or patch — whatever you POST becomes the new env. A test write like `{"env":"TEST=1",...}` silently wipes all production secrets with no warning, no confirmation, and an HTTP 200 response.

## When this applies
Any time you call `POST /api/application.saveEnvironment` on the Dokploy API at `https://dokploy.prochat.tools`. Especially when testing the API shape or scripting bulk env updates.

## The approach
Always: **GET current state → modify in memory → POST full string back.**  
Never use `saveEnvironment` to spot-test the API shape or auth — use a read endpoint instead.  
Never build the payload in shell heredoc — env strings contain newlines, quotes, and special chars that break JSON. Use Python with a temp file.

## The fix

```python
# Pattern: GET → modify → POST via temp file
import json, subprocess, tempfile, os

app = json.loads(subprocess.run(
    ["curl", "-s", f"{DOKPLOY_URL}/api/application.one?applicationId={app_id}",
     "-H", f"x-api-key: {DOKPLOY_API_KEY}"],
    capture_output=True, text=True
).stdout)

new_env = app["env"] + "\nNEW_VAR=value"  # modify, don't replace

payload = {
    "applicationId": app_id,
    "env": new_env,
    "buildArgs": app.get("buildArgs", "") or "",
    "buildSecrets": app.get("buildSecrets", "") or "",
    "createEnvFile": app.get("createEnvFile", True),
}

with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    json.dump(payload, f)
    tmpfile = f.name

subprocess.run(
    ["curl", "-s", "-X", "POST", f"{DOKPLOY_URL}/api/application.saveEnvironment",
     "-H", f"x-api-key: {DOKPLOY_API_KEY}",
     "-H", "Content-Type: application/json",
     "-d", f"@{tmpfile}"],
    capture_output=True, text=True
)
os.unlink(tmpfile)
```

**Required fields (all must be present or you get 400):** `applicationId`, `env`, `buildArgs`, `buildSecrets`, `createEnvFile`

## Gotchas
- `buildArgs` and `buildSecrets` can be empty string `""` but cannot be `undefined` or absent — they are required non-optional fields
- `createEnvFile` must be boolean `true`, not absent
- The API returns HTTP 200 for a `TEST=1` write — no warning whatsoever
- `source ~/.config/dokploy/.env` in bash does not export to Python subprocesses — use explicit `os.environ["KEY"]` after exporting in the shell, or read the file directly in Python
- NODE_OPTIONS merge: if an app already has `NODE_OPTIONS=--max-old-space-size=3072`, append `--require newrelic` to the existing value with regex, don't overwrite

## Context
Repo: brain / prochattools (all Dokploy apps)  
Discovered: 2026-04-05  
Area: Dokploy REST API — `POST /api/application.saveEnvironment`
