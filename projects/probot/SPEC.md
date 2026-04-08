# ProBot Technical Spec

## Product Positioning

ProBot is a personal Slack-first control plane, with Telegram fallback, for the local Brain + Claude + Codex stack.

It is not a clone of OpenClaw (retired AWS VPS bridge, decommissioned 2026-04-04).

It exists to solve five practical problems:

1. Remote access to trusted files and notes
2. Fast capture of text and voice notes
3. Fast access to Brain context and decisions
4. Clear visibility into Claude and Codex session state
5. Safe triggering of local workflows from chat channels

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
- maintain Slack Socket Mode when configured
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

There is no always-running model loop or indexer in MVP.

One narrow background monitor is allowed for dashboard correctness:

- a bounded Codex usage refresh task runs every 5 minutes
- it first reads Codex's local session-log `token_count.rate_limits` events
- it only triggers a minimal Codex probe when the cached 5-hour or 7-day window has expired, or when there is no usable fresh sample

This monitor exists solely to keep the dashboard's Codex credit percentage aligned with the real reset windows while staying token-efficient.

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
- Slack setup
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
- `codex-usage.ts` — resolves Codex 5h/7d remaining percentages from local session logs, caches snapshots, and performs bounded refresh probes only when needed for dashboard accuracy

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

- only approved Telegram and Slack user IDs may interact
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

The preferred remote UX is:

1. `home`
2. `recent`
3. `continue <1-5>` when choosing among the last five sessions
4. `focus <repo>` or `resume <repo>`
5. `ssh <repo>`

This sequence is optimized for fast orientation in Slack and fast continuation in SSH + `tmux` from mobile.

### `/home`

Returns:

- host and channel state
- pending approval count
- most recent sessions
- repo handoff freshness
- quick next commands for continuation

### `/focus <repo>`

Returns:

- repo path
- handoff preview
- matching recent sessions
- `intent · repo` labeled matching sessions
- direct `tmux attach` hints for active sessions
- embedded SSH and resume guidance
- standardized advisory suggestion as `resume <repo>`

### `/recent`

Returns:

- the last five resumable sessions across Claude, Codex, and Gemini
- compact numbered lines optimized for a phone screen
- one-line natural-language headlines so sessions are easy to distinguish quickly
- smart ranking that prefers live tmux sessions and fresher repo handoffs before plain recency
- one short `intent · repo` label inferred from the session headline and repo handoff goal
- one explicit `Suggested next action` line that is clearly advisory and not yet executed
- standardized advisory suggestion as `continue <n>`

### Dashboard continuation UX

Behavior:

- reuses the same ranked continuation candidates as `home` and `recent`
- shows `intent · repo` labels and explicit advisory `Suggested next action` text
- adds a desktop-only Ghostty handoff button that pastes, but does not execute, the suggested command
- enables the Ghostty button only on `localhost` dashboard access to avoid exposing local OS actions on remote dashboard hosts

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
- recent Gemini sessions
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

### `/jobs`

Returns:

- pending approvals
- approval IDs
- expiry timestamps

### `/approve <id>` and `/reject <id>`

Handles:

- file-send approvals
- bounded operational presets such as `restart-probot`

### `/tail [target]`

Returns:

- recent local log lines for known targets only
- supported targets:
  - `probot`
  - `probot-stdout`
  - `probot-stderr`
  - `scheduler`
  - `scheduler-error`
  - `n8n-backup`
  - `dance-of-life`
  - `dance-of-life-sync`
  - `claude-cleanup`

### `/report [scheduler]`

Returns:

- the latest rendered runtime report for known report targets
- initial supported target:
  - `scheduler`

### `/run restart-probot`

Behavior:

- does not expose generic shell access
- creates an approval-gated restart request
- on approval, schedules a `launchctl kickstart` restart for the local ProBot agent

### `/ssh [repo]`

Returns:

- `ssh office` continuation guidance
- `tmux` attach instructions
- repo-specific directory and suggested new-session name when a repo is provided

### `/continue <repo>`

Alias for `/resume <repo>` with the same guided continuation output.

### `/continue <1-5>`

Behavior:

- resolves against the current top-five recent-session list
- that top-five list is ranked by continuation likelihood, not just raw recency
- returns the exact continuation path for that selected session
- includes the one-command `probot-continue.sh` invocation plus direct tool resume command

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

## Dashboard Usage Strategy

The optional local dashboard includes Codex AI usage cards for the 5-hour and 7-day windows.

Source of truth:

- Codex local session logs under `~/.codex/sessions/**/*.jsonl`
- specifically `event_msg` entries where `payload.type = "token_count"` and `payload.rate_limits` is present

Refresh strategy:

- ProBot reads the newest available rate-limit event and writes a normalized cache to `projects/probot/data/codex-usage.json`
- a 5-minute background monitor keeps the cache warm
- if the cached reset timestamp has passed, or there is no usable sample, ProBot runs a tiny non-interactive Codex probe to force a fresh `token_count` event
- the probe is cooldown-limited so the dashboard does not repeatedly spend tokens while waiting for the next reset

Why this exists:

- historical session-log parsing alone can go stale across reset boundaries
- the bounded probe path fixes the stale-percentage problem without introducing a constant synthetic prompt loop

Future additions:

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
