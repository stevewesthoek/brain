# ProBot

ProBot is a lightweight, always-on local Telegram control plane for the Brain repo and the existing Claude/Codex workflow on this Mac.

It is intentionally not a general-purpose agent platform. The goal is fast remote access to trusted local workflows with a small, auditable codebase and low idle resource usage.

## Goals

- Telegram-first remote access
- Brain-aware file and note workflows
- Claude/Codex session overview and summarization
- Safe local execution with allowlisted roots and confirmation gates
- Low idle CPU and memory footprint

## MVP Scope

- Telegram bot via long polling
- User ID allowlist
- Local SQLite state for approvals and event logging
- Session overview for Claude and Codex
- Text note capture
- Brain search
- File search and approved file send

## Non-Goals

- No public web server
- No always-running LLM loop
- No untrusted community skill loading
- No broad shell access in the first version

## Commands

- `/help` — show command list
- `/status` — daemon health and machine summary
- `/sessions` — recent Claude and Codex sessions
- `/summary [today|week]` — compact session digest
- `/note <text>` — save a text note
- `/brain <query>` — search the Brain repo
- `/find <query>` — search files by name and content
- `/send <absolute-path>` — request approval to send a file

## Local Run

Preferred secret location:

- `~/.config/probot/.env`

Fallback for local development:

- `projects/probot/.env`

1. Copy `.env.example` to `~/.config/probot/.env`
2. Fill in your Telegram token and allowed user ID
3. Run `npm install`
4. Run `npm run dev`

ProBot will load env vars in this order:

1. `PROBOT_ENV_FILE` if set and present
2. `~/.config/probot/.env`
3. local `.env` in `projects/probot/`

## Production Run

- `npm run build`
- `npm run start`
- Install the launchd agent with `./scripts/install-launchd.sh`

## Notes Storage

By default, notes are written under:

- `projects/probot/inbox/YYYY/YYYY-MM-DD.md`

This keeps capture local to the ProBot project until you decide which captured items should be promoted into more canonical Brain locations.

## Main Docs

- [SPEC.md](./SPEC.md)
- [.env.example](./.env.example)
