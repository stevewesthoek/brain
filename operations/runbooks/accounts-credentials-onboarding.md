# Accounts & Credentials — Project Onboarding Standard

This runbook defines the canonical way to add a new project to the Brain Console **Accounts & Credentials** tab. All projects follow the same pattern. Never improvise — follow these steps exactly.

---

## Core concepts

| Concept | What it means |
|---------|---------------|
| **Project** | A repo/product with its own accounts (e.g. `says-the-bible`) |
| **Platform** | A service that project uses (YouTube, Pinterest, Facebook, …) |
| **Credential** | A single key/secret/token for a platform |
| **Storage backend** | Where the credential lives: `env_file` (`.env` file in repo), `keychain` (macOS keychain via `youtube_uploader.py`), `plist` (LaunchAgent plist — infra only) |
| **Token paths** | Always auto-computed as `~/.local/video-orchestrator/data/<projectId>/<platform>-token.json`. Never expose to the user. Never configurable. |
| **Deeplink** | A URL button in the UI that opens the exact page where the user obtains a credential |

---

## Token path standard

Token files are always stored at:

```
~/.local/video-orchestrator/data/<projectId>/<platform>-token.json
```

Examples:
- `~/.local/video-orchestrator/data/says-the-bible/youtube-token.json`
- `~/.local/video-orchestrator/data/says-the-bible/pinterest-token.json`

This path is computed at runtime by the uploader scripts. It is **never** a credential field. Do not add `TOKEN_PATH` fields to any schema.

---

## File locations

| What to edit | Where |
|---|---|
| Credential schema (source of truth) | `projects/brain-core/src/adapters/credentials.ts` |
| API types (console ↔ core contract) | `projects/brain-console-obsidian/src/client.ts` |
| UI rendering | `projects/brain-console-obsidian/src/view.ts` |
| UI styles | `projects/brain-console-obsidian/styles.css` |

---

## Step-by-step: add a new project

### 1. Add the repo path to `PROJECT_ENV_MAP`

```typescript
// In credentials.ts — PROJECT_ENV_MAP
const PROJECT_ENV_MAP: Record<string, string> = {
  'says-the-bible': expandHome('~/Repos/prochattools/web/says-the-bible/.env.pipeline.production'),
  'my-new-project': expandHome('~/Repos/prochattools/web/my-new-project/.env.production'),
};
```

The key is the `projectId` used everywhere. Use `kebab-case`. The value is the absolute path to the project's `.env` file.

### 2. Add the display name to `PROJECT_DISPLAY_NAMES`

```typescript
const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  'says-the-bible': 'Says the Bible',
  'my-new-project': 'My New Project',
};
```

### 3. Add the credential schema to `CREDENTIAL_SCHEMA`

```typescript
const CREDENTIAL_SCHEMA: Record<string, PlatformSchema[]> = {
  'my-new-project': [
    {
      platformId: 'youtube',
      platformName: 'YouTube',
      platformCategory: 'social',
      credentials: [
        { key: 'YOUTUBE_CLIENT_ID',     label: 'OAuth Client ID',     type: 'app_id', required: true,
          hint: 'From Google Cloud Console → Credentials → OAuth 2.0 Client IDs',
          deeplink: 'https://console.cloud.google.com/apis/credentials' },
        { key: 'YOUTUBE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'secret', required: true },
        // VO Worker OAuth — always storage: 'keychain', always the last entry
        { key: 'yt-oauth-client-@my-channel', label: 'VO Worker OAuth (@my-channel)', type: 'secret', required: true, storage: 'keychain',
          hint: 'OAuth token for the video orchestrator worker — click Connect to authorize via browser' },
      ],
    },
    // Add more platforms as needed (Pinterest, Facebook, etc.)
  ],
};
```

**Rules:**
- Never add `YOUTUBE_TOKEN_PATH` or `PINTEREST_TOKEN_PATH` — token paths are auto-computed.
- Every credential that requires browser OAuth (YouTube, Pinterest) must use `storage: 'keychain'`.
- Add a `deeplink` to any credential where the user needs to navigate to an external page to get the value.
- `required: true` means the UI shows a red badge and counts toward `allRequiredSet`.

### 4. No changes needed in `view.ts` or `client.ts`

The rendering is fully generic:
- `env_file` credentials → text/password input with Save button
- `keychain` credentials → Connect button that launches the OAuth browser flow
- `deeplink` → small "↗ Open" button next to the hint text

No per-project rendering code is ever needed.

### 5. Build and deploy

```bash
# 1. Rebuild Brain Core
cd projects/brain-core && npm run build

# 2. Restart Brain Core (picks up new schema)
kill $(lsof -ti :4877) && nohup node dist/index.js > /tmp/brain-core.log 2>&1 &

# 3. Rebuild and deploy the console
cd projects/brain-console-obsidian
npm run build && npm run package && npm run install:active-vault

# 4. Restart Obsidian
pkill -x "Obsidian" && sleep 2 && open -a Obsidian
```

---

## Storage backend reference

| Backend | Where | Used for | Set via |
|---------|-------|----------|---------|
| `env_file` | Project `.env` file | API keys, secrets, board IDs, page IDs | Text input → Save |
| `keychain` | macOS keychain service `video-orchestrator` | YouTube OAuth tokens | Connect button → browser OAuth flow |
| `plist` | LaunchAgent plist XML | Machine-level infra (CF Access, n8n webhook) | Infrastructure section — manual plist edit or via infra API |

---

## Platform templates (`AVAILABLE_PLATFORMS`)

When a user-registered project is added via the console UI (not hardcoded), it picks from `AVAILABLE_PLATFORMS`. This list must stay in sync with the same rules above — no token paths, deeplinks where applicable.

---

## Adding a new platform type

If the new project uses a platform not yet in `AVAILABLE_PLATFORMS` (e.g. LinkedIn, Substack):

1. Add it to `AVAILABLE_PLATFORMS` in `credentials.ts` following the same pattern.
2. Add its icon to the `platformIcons` map in `renderProjectPlatformCard` in `view.ts`.
3. No other changes needed unless the platform uses OAuth (then add `storage: 'keychain'` and wire up a new `render*OAuthRow` function if the flow differs from YouTube).

---

## Invariants — never break these

- `YOUTUBE_TOKEN_PATH` and `PINTEREST_TOKEN_PATH` must never appear in any schema.
- `storage: 'keychain'` credentials always render as a Connect/OAuth button, never a text input.
- `deeplink` URLs always open via `openExternalUrl()` (Electron-safe), never `window.open`.
- Promise count in `view.ts` must stay aligned — run the alignment check after any `view.ts` change.
- Every project must have the same `.env` path format: `<repoPath>/<envFileName>`.
