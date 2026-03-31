# openclaw-claude-bridge

Bridges your OpenClaw VPS to Claude Code CLI sessions running on your Mac Mini.
OpenClaw calls this service over Tailscale. The bridge manages Claude Code via tmux,
polls for output, detects confirmations, and pushes results back to OpenClaw —
which formats and delivers them to Telegram with inline buttons.

## Architecture

```
You (Telegram)
    ↓
OpenClaw Gateway (VPS 100.101.212.108:18789)
    ↓  POST /prompt  [X-Bridge-Secret]  over Tailscale
Mac Mini Bridge (100.86.124.66:3457)
    ↓  tmux send-keys → Claude Code session
    ↓  poll capture-pane every 2s until stable
    ↑  POST /v1/chat/completions → OpenClaw (result + session key)
OpenClaw formats as Telegram HTML → sends with inline buttons
```

**Async model:** Bridge returns `202 Accepted` immediately. OpenClaw continues.
Bridge polls Claude in background, then callbacks OpenClaw when done.
No blocking, no timeout risk on either side.

---

## Prerequisites

- **Mac Mini** (this machine) with Tailscale connected
- **tmux** installed: `brew install tmux`
- **Claude Code CLI** installed and accessible as `claude` in PATH
- **Node.js 20+** installed
- **OpenClaw** running on VPS (already set up)

---

## Setup

### 1. Install dependencies

```bash
cd openclaw-claude-bridge
npm install
```

### 2. Create .env

```bash
cp .env.example .env
```

Fill in these values (minimum required):

```
BRIDGE_SECRET=<generate a strong random string>
OPENCLAW_BEARER_TOKEN=vArpEMeiiPzS4NBlKXmE5V6lWY33lcDf
```

All other values have safe defaults matching your exact setup.

### 3. Required OpenClaw config change

**This must be done in OpenClaw before the bridge can callback.**

The OpenClaw gateway is currently bound to `loopback`, which means only processes
on the VPS itself can reach it. The Mac Mini needs to POST results back over Tailscale.

**Change `gateway.bind` in your OpenClaw config from `"loopback"` to `"0.0.0.0"`**
(see the OpenClaw prompt at the bottom of this README for the exact command).

### 4. Run

```bash
# Development (hot reload)
./scripts/dev.sh

# Production
./scripts/prod.sh
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BRIDGE_SECRET` | *(empty)* | Shared secret. OpenClaw sends as `X-Bridge-Secret` header. **Set this.** |
| `BRIDGE_HOST` | `100.86.124.66` | Mac Mini Tailscale IP. Bridge only listens here, not 0.0.0.0. |
| `BRIDGE_PORT` | `3457` | Port the bridge listens on. |
| `ALLOWED_IPS` | `100.101.212.108` | Comma-separated IPs allowed to call the bridge. |
| `OPENCLAW_GATEWAY_URL` | `http://100.101.212.108:18789` | OpenClaw gateway URL for callbacks. |
| `OPENCLAW_AGENT_ID` | `main` | OpenClaw agent ID to route callbacks to. |
| `OPENCLAW_BEARER_TOKEN` | *(empty)* | OpenClaw gateway bearer token. **Set this.** |
| `REPOS_ROOT` | `/Users/Office/Repos` | Root directory for all repos. |
| `OUTPUT_TRUNCATE_CHARS` | `4000` | Max output chars (Telegram message limit). |
| `POLL_INTERVAL_MS` | `2000` | How often to poll tmux pane (ms). |
| `POLL_MAX_ATTEMPTS` | `60` | Max poll attempts before timeout (60 × 2s = 2 min). |
| `STABILITY_REQUIRED_POLLS` | `3` | Consecutive identical polls = Claude is done. |
| `CLAUDE_STARTUP_WAIT_MS` | `4000` | Wait after starting Claude before accepting prompts. |
| `SKILLS_DIR` | `…/brain/ai/skills/active` | Path to Claude Code skills directory. |
| `ALLOW_SHELL_EXEC` | `false` | ⚠️ Enable POST /shell. Keep false in production. |
| `LOG_LEVEL` | `info` | Pino log level: trace, debug, info, warn, error. |

---

## API endpoints

All endpoints (except `/health`) require:
- `X-Bridge-Secret: <your BRIDGE_SECRET>` header
- Request must come from an IP in `ALLOWED_IPS`

All responses include a `telegram` field with `text` (Telegram HTML) and optionally `buttons` for inline keyboards.

---

### `GET /health`

Health check. No auth required.

```bash
curl http://100.86.124.66:3457/health
```

Response:
```json
{
  "ok": true,
  "status": "healthy",
  "bridge": "openclaw-claude-bridge v1",
  "claudeBin": "/usr/local/bin/claude",
  "tmuxVersion": "tmux 3.4",
  "activeSessions": 2,
  "sessions": ["claude-default", "claude-prochattools-saas-proofly"],
  "timestamp": "2026-03-31T12:00:00.000Z"
}
```

---

### `GET /skills`

List available Claude Code skills from the brain skills directory.
Returns inline keyboard buttons for Telegram.

```bash
curl -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  http://100.86.124.66:3457/skills
```

Response:
```json
{
  "ok": true,
  "action": "list_skills",
  "count": 42,
  "skills": [
    { "name": "ship", "description": "Ship workflow: detect + merge...", "command": "/ship" }
  ],
  "telegram": {
    "text": "<b>🛠 Available skills (42)</b>\n...",
    "parse_mode": "HTML",
    "buttons": [[{ "text": "/ship", "callback_data": "skill_ship" }, { "text": "/review", "callback_data": "skill_review" }]]
  }
}
```

---

### `GET /sessions`

List active Claude Code tmux sessions.

```bash
curl -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  http://100.86.124.66:3457/sessions
```

---

### `POST /sessions`

Create (or resume) a Claude Code session for a repo.

```bash
curl -X POST -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"repo": "prochattools/saas/proofly"}' \
  http://100.86.124.66:3457/sessions
```

Body: `{ repo?: string }` — path relative to REPOS_ROOT. Omit for default session.

Response:
```json
{
  "ok": true,
  "action": "create_session",
  "sessionId": "claude-prochattools-saas-proofly",
  "repo": "/Users/Office/Repos/prochattools/saas/proofly",
  "created": true
}
```

---

### `DELETE /sessions/:id`

Stop a Claude Code session.

```bash
curl -X DELETE -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  http://100.86.124.66:3457/sessions/claude-prochattools-saas-proofly
```

---

### `POST /prompt` ⚡ main endpoint

Send a prompt to Claude Code. Returns `202 Accepted` immediately.
Result is pushed back to OpenClaw via `/v1/chat/completions` when done.

```bash
curl -X POST -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "/ship",
    "repo": "prochattools/saas/proofly",
    "session_key": "telegram-session-abc123",
    "agent_id": "main"
  }' \
  http://100.86.124.66:3457/prompt
```

Body:
| Field | Required | Description |
|---|---|---|
| `prompt` | ✅ | The prompt or slash command to send to Claude Code |
| `repo` | — | Repo path relative to REPOS_ROOT. Omit for default session. |
| `session_key` | — | OpenClaw session key — passed back in callback to land in right Telegram conversation |
| `agent_id` | — | OpenClaw agent ID for callback. Defaults to `OPENCLAW_AGENT_ID`. |

Response (202):
```json
{
  "ok": true,
  "action": "send_prompt",
  "status": "accepted",
  "jobId": "uuid-here",
  "sessionId": "claude-prochattools-saas-proofly",
  "telegram": { "text": "⚡ <b>Prompt sent...</b>", "parse_mode": "HTML" }
}
```

**If Claude asks for confirmation**, the bridge callbacks OpenClaw with:
- The question text formatted in HTML
- `metadata.buttons` containing Approve/Deny inline keyboard data
- `metadata.requiresConfirmation: true`
- `metadata.jobId` for routing the `/confirm` call

---

### `POST /confirm`

Send an approval or denial to a waiting Claude Code confirmation prompt.

```bash
# Approve
curl -X POST -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "uuid-here", "action": "approve", "session_key": "telegram-session-abc123"}' \
  http://100.86.124.66:3457/confirm

# Deny
curl -X POST -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "uuid-here", "action": "deny"}' \
  http://100.86.124.66:3457/confirm
```

Body:
| Field | Required | Description |
|---|---|---|
| `action` | ✅ | `"approve"` or `"deny"` |
| `job_id` | — | Job ID from the confirmation callback |
| `session_id` | — | Alternative to job_id: direct session ID |
| `session_key` | — | OpenClaw session key for callback routing |

---

### `GET /repo/status`

Get git status, branch, and last commit for a repo.

```bash
curl -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  "http://100.86.124.66:3457/repo/status?repo=prochattools/saas/proofly"
```

Response:
```json
{
  "ok": true,
  "action": "repo_status",
  "repo": "/Users/Office/Repos/prochattools/saas/proofly",
  "branch": "main",
  "status": "M src/app.ts",
  "lastCommit": "a1b2c3d fix: payment flow"
}
```

---

### `POST /shell` ⚠️ DANGEROUS

Execute an arbitrary shell command. **Disabled by default.**
Only enabled when `ALLOW_SHELL_EXEC=true`.

```bash
curl -X POST -H "X-Bridge-Secret: $BRIDGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"command": "git log --oneline -5", "cwd": "prochattools/saas/proofly"}' \
  http://100.86.124.66:3457/shell
```

`cwd` must be within REPOS_ROOT and pass the allowlist check.

---

## Callback format to OpenClaw

When the bridge posts a result back to OpenClaw, it uses:

```
POST http://100.101.212.108:18789/v1/chat/completions
Authorization: Bearer <OPENCLAW_BEARER_TOKEN>
x-openclaw-agent-id: main
x-openclaw-session-key: <original session key>
Content-Type: application/json

{
  "model": "bridge-callback",
  "messages": [{ "role": "user", "content": "<Telegram HTML>" }],
  "metadata": {
    "jobId": "...",
    "sessionId": "...",
    "parse_mode": "HTML",
    "buttons": [[...]]         // present when requiresConfirmation: true
  }
}
```

OpenClaw receives this as a new agent turn, reads `metadata.buttons` to render
inline keyboard, and delivers `content` to the original Telegram conversation.

---

## Session naming

Sessions are named deterministically:

| Input | Session ID |
|---|---|
| No repo (default) | `claude-default` |
| `prochattools/saas/proofly` | `claude-prochattools-saas-proofly` |
| `stevewesthoek/brain` | `claude-stevewesthoek-brain` |

---

## Safety notes

- Bridge binds to Tailscale IP only (`100.86.124.66`), not `0.0.0.0`
- All non-health requests require IP allowlist + shared secret
- Path traversal is blocked: all repo paths must be under REPOS_ROOT and in allowlist
- Shell execution is off by default and clearly flagged when enabled
- Secrets are never logged
- Session names are validated before any tmux command
- Only sessions prefixed `claude-` can be stopped via the API

---

## Deferred to v2

- Streaming tmux output (real-time push as Claude types)
- Per-request approval timeout with auto-deny
- Session persistence across bridge restarts (currently in-memory)
- Paginated skill menus (inline grid scrolling)
- Voice transcription integration
- Richer OpenClaw callback metadata (typing indicators, edit-in-place)
- `pm2` / launchd service wrapper for auto-restart

---

## OpenClaw configuration command

See the section below for the exact prompt to send to OpenClaw to complete setup on the VPS side.
