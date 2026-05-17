# Brain Console Obsidian Plugin

Standalone read-only Brain Core console scaffold.

Validation status:

- `npm run typecheck` passes
- `npm run build` passes
- `npm run package` emits a local `release/` bundle for manual install

## Intended structure

```text
projects/brain-console-obsidian/
├── .codex-plugin/plugin.json
├── manifest.json
├── package.json
├── src/
│   ├── client.ts
│   ├── main.ts
│   ├── settings.ts
│   └── view.ts
├── styles.css
└── tsconfig.json
```

## Safety boundaries

- Read-only only.
- No note writes.
- No automatic POST calls.
- No secrets in settings.
- No installation into `mind/.obsidian/plugins/` until explicitly approved.
- Manual refresh only.
- Offline state is shown when Brain Core is unavailable.
- Runtime reports and capabilities are read from Brain Core, not copied into Mind notes.
- Runtime reports include the read-only `local-apps` and `video` summaries generated under `runtime/local/`.
- Manual installation into `mind/.obsidian/plugins/` is required and should be approved separately.

## Manual install path

1. Run `npm run build`.
2. Run `npm run package`.
3. Copy the reviewed plugin files from `release/` into a manually approved Obsidian plugin folder.
4. Verify Brain Core `/status`, `/capabilities`, and `/runtime/reports` render correctly.
5. Verify the plugin stays read-only and does not call POST endpoints automatically.

## Current status

This is a scaffold only. It is enough to define the standalone project boundary and the Brain Core endpoints it should render later.
