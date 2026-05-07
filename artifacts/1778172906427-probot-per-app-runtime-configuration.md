# ProBot per-app runtime configuration

## Problem

ProBot manages multiple local apps from a single dashboard. Some apps require a specific runtime, but ProBot itself and the other managed apps should not be forced onto that runtime.

The immediate case is Says the Bible: local Next.js 14 builds and dashboard runs are stable on Node 20, while the host shell may resolve `node` to a newer Homebrew Node. ProBot must start Says the Bible with Node 20 without changing ProBot's own Node version or every other app's Node version.

## Solution

ProBot now supports app-specific runtime settings in `operations/infrastructure/local-apps.json` via a `runtime` object on each app entry.

Supported runtime fields:

```json
{
  "runtime": {
    "pathPrepend": ["/absolute/path/to/bin"],
    "env": {
      "KEY": "value"
    },
    "notes": "Human-readable explanation."
  }
}
```

`pathPrepend` is prepended to `PATH` only when launching or stopping that specific app. It does not mutate ProBot's process runtime and does not affect other app entries.

`env` is merged into the child process environment for that specific app only. Values must be strings. Do not put secrets in this shared local app registry.

## Says the Bible configuration

Says the Bible is configured with:

```json
"runtime": {
  "pathPrepend": ["/Users/Office/.nvm/versions/node/v20.20.2/bin"],
  "notes": "Says the Bible uses Next.js 14 and must run locally with Node 20. This runtime override is app-specific and does not change ProBot or other local apps."
}
```

ProBot still calls the same central lifecycle commands for Says the Bible:

```text
start: bash scripts/dev/start-local.sh
stop:  bash scripts/dev/stop-local.sh
```

The runtime override means those helper scripts inherit a `PATH` where Node 20 comes first. The `next` binary inside Says the Bible therefore resolves `/usr/bin/env node` to Node 20.

## Design principles

- Centralize lifecycle policy in ProBot.
- Keep app-specific runtime needs in the local app registry, not scattered through shell snippets.
- Do not change ProBot's own runtime globally.
- Do not change unrelated apps.
- Prefer explicit absolute paths for runtimes that must be stable.
- Keep secrets out of the registry.

## Validation checklist

Run from `projects/probot`:

```bash
npm run typecheck
npm test
npm run build
```

Then restart Says the Bible from ProBot and verify:

```bash
curl -fsS http://localhost:3058/api/health
lsof -ti :3058 | xargs ps -o pid,command -p
```

The app should be healthy on port 3058. The start path is controlled by ProBot's `runtime.pathPrepend` for Says the Bible only.
