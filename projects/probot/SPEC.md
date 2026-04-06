# ProBot Technical Spec

## Product Positioning

ProBot is a personal Telegram command center for the local Brain + Claude + Codex stack.

It is not a clone of OpenClaw (retired AWS VPS bridge, decommissioned 2026-04-04).

It exists to solve five practical problems:

1. Remote access to trusted files and notes
2. Fast capture of text and voice notes
3. Fast access to Brain context and decisions
4. Clear visibility into Claude and Codex session state
5. Safe triggering of local workflows from Telegram

## Product Principles

- Local-first
- Low idle overhead
- Explicit command routing over autonomous behavior
- Brain remains canonical memory
- SQLite stores bot state only
- Confirm before destructive or sensitive actions
- No public ports
- No untrusted skill/plugin execution

## Runtime Model

### Core process

One always-on Node.js daemon started by `launchd`.

Responsibilities:

- long-poll Telegram
- authenticate sender
- parse commands
- route to local services
- manage approval tokens
- persist small local state

### On-demand workers

Work is only done when:

- a Telegram message arrives
- a scheduled summary job runs
- a local maintenance task is invoked

There is no always-running model loop, indexer, or proactive heartbeat in MVP.

## Resource Targets

### Idle mode

- CPU: effectively idle outside Telegram poll wake-ups
- Memory: one Node process plus SQLite handle
- Disk I/O: minimal, append-only event logging and approval state

### Burst mode

Subprocess-heavy work such as session parsing, repo search, or future mail/calendar actions only runs on demand and is bounded with timeouts.

## Architecture

### `src/index.ts`

Bootstraps config, SQLite, services, and Telegram polling.

### `src/bot/*`

- Telegram setup
- command registration
- callback approval handling
- message formatting

### `src/services/*`

- `status.ts`
- `sessions.ts`
- `notes.ts`
- `brain.ts`
- `files.ts`
- `intents.ts` — natural language router; maps plain-text messages to service calls without LLM (pattern matching only)

Future:

- `mail.ts`
- `calendar.ts`
- `contacts.ts`
- `voice.ts`

### `src/connectors/*`

Thin wrappers around local commands and file paths:

- Claude session storage
- Codex session storage
- Brain repo search
- future Google/n8n connectors

### `src/store/*`

SQLite access and schema setup.

## Security Model

### Secret storage

Secrets should not live inside the Brain repo, even if ignored.

Preferred storage:

- `~/.config/probot/.env`

Rules:

- store actual credentials outside the repo
- keep only templates and secret-location docs in the repo
- use `PROBOT_ENV_FILE` only when a non-default local secret path is needed

### Identity

- only approved Telegram user IDs may interact
- everyone else is ignored

### Filesystem

- access is limited to allowlisted roots
- denylist for sensitive paths even if nested under broad roots
- file sends require approval

Default denylist examples:

- `~/.ssh`
- `~/.gnupg`
- `~/.aws`
- `~/.config`
- browser profiles
- `*.env`
- keychain-export locations

### Actions requiring approval

- sending a file to Telegram
- moving or deleting files
- future shell execution
- future mail sending
- future calendar modifications

### Logging

- no secrets in logs
- no note contents or file bodies in console logs unless debug mode is explicitly enabled

## Data Model

SQLite tables:

### `approvals`

- `id`
- `kind`
- `payload_json`
- `status`
- `created_at`
- `expires_at`

### `events`

- `id`
- `kind`
- `payload_json`
- `created_at`

Purpose:

- approval lifecycle
- basic audit trail
- future analytics for command usage

## Command Surface

### `/status`

Returns:

- ProBot state
- machine hostname
- uptime
- load average
- memory summary
- database path

### `/sessions`

Returns:

- recent Claude sessions
- recent Codex sessions
- age
- repo path summary
- first meaningful prompt / session name
- whether a matching tmux session appears active

### `/summary [today|week]`

Returns:

- total recent sessions by tool
- top repos touched
- latest work threads
- compact “likely next” hints derived from recent session metadata

This is intentionally heuristic in MVP, not LLM-generated.

### `/note <text>`

Appends a timestamped note to:

- `projects/probot/inbox/YYYY/YYYY-MM-DD.md`

### `/brain <query>`

Searches the Brain repo using ripgrep and returns top snippets.

This is search-first in MVP.

Future version:

- optional LLM synthesis over retrieved context

### `/find <query>`

Searches allowlisted roots by:

- filename match
- content match fallback

Returns path, size, and modified time.

### `/send <absolute-path>`

Validates the path, previews the target, creates an approval token, and only sends on explicit confirmation.

## Session Visibility Strategy

This is one of ProBot’s core jobs.

MVP data sources:

- `~/.claude/projects/**/*.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/sessions/**/*.jsonl`
- `tmux ls`

Future additions:

- snapshot summaries cached into SQLite
- daily and weekly digests
- “stale session cleanup” recommendations
- resume shortcuts

## Future Integrations

These are in scope for Phase 2, not MVP:

### Voice notes

- Telegram voice file download
- transcription
- classification into note/task/calendar request

### Mailbox

- Gmail or Google Workspace summary
- unread overview
- action list extraction

### Calendar + contacts

- create Google Calendar event
- add Meet link
- resolve attendees from contacts
- preview and confirm before save

## Process Management

`launchd` should manage the daemon:

- `RunAtLoad = true`
- `KeepAlive = true`
- stdout/stderr redirected to local log files

On Mac sleep/wake:

- Telegram polling should naturally reconnect
- no special wake hook is needed in MVP

## Phased Roadmap

### Phase 1

- local daemon
- Telegram auth
- status
- sessions
- summary
- note capture
- brain search
- file search/send

### Phase 2

- voice note transcription
- file move/rename/archive
- calendar and contacts
- mailbox triage

### Phase 3

- optional local dashboard
- scheduled morning / weekly digests
- richer session graph and workstream overview

## Decision Log Notes

ProBot is an active project running as a launchd daemon on the Office Mac. The following decisions are confirmed and mirrored in `operations/decision-log.md`:

- ProBot is a local daemon, not a web app
- Telegram is the primary interface
- Brain is the canonical memory layer
- SQLite is bot-state only
- MVP prioritizes session visibility over broad automation
- OpenClaw (AWS VPS bridge) was retired 2026-04-04; ProBot is the sole Telegram control surface
