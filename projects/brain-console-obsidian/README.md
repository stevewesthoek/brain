# Brain Console Obsidian Plugin

Standalone read-only Brain Core console scaffold.

Validation status:

- `npm run typecheck` passes
- `npm run build` passes

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

## Current status

This is a scaffold only. It is enough to define the standalone project boundary and the Brain Core endpoints it should render later.
