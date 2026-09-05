# Brain Console Manual Install Test

> **Historical/manual test only — not the current production authority.** Brain
> Console 2.0 live activation is complete. Use
> `operations/runbooks/brain-console-2-operations.md` for the current plugin,
> runtime, recovery, and Console ↔ Obsidian procedures. This document remains
> only for bounded package-install regression work.

This runbook covers a manual install and smoke test for the standalone `brain-console-obsidian` plugin.

## Prerequisites

- Brain Core is running locally at `http://127.0.0.1:4877`.
- The plugin has been built and packaged in `projects/brain-console-obsidian/release/`.
- Explicit user approval exists before touching any `mind/.obsidian/plugins/` path.

## Package review

Inspect the release folder first:

```bash
find projects/brain-console-obsidian/release -maxdepth 2 -type f | sort
du -sh projects/brain-console-obsidian/release
```

Expected install-safe files:

- `manifest.json`
- `main.js`
- `styles.css`
- `README.md` if included

Do not copy:

- `node_modules`
- `.env`
- runtime logs
- source maps with local-path leakage
- settings caches

## Manual install steps

1. Build and package the plugin.
2. Inspect the release files.
3. Choose the target plugin folder manually.
4. Copy only the approved install files into the chosen folder.
5. Enable the plugin manually in Obsidian.
6. Set the Brain Core URL to `http://127.0.0.1:4877`.
7. Use manual refresh to load the dashboard.

## Verification checklist

- Status renders.
- Capabilities render.
- Runtime reports render.
- Local apps render.
- Video status and queue render.
- Offline state works when Brain Core is stopped.
- No notes are written.
- No POST calls are made automatically.
- Action execution remains disabled.

## Rollback

1. Disable the plugin in Obsidian.
2. Remove the manually installed plugin folder.
3. Restore `.obsidian/community-plugins.json` only if explicitly needed.

## Safety

- Do not commit local `.obsidian` install state unless it has been reviewed.
- Do not copy runtime reports into Mind notes.
- Do not store secrets in plugin settings.
