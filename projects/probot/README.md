# ProBot

ProBot is a lightweight, always-on local Slack and Telegram control plane for the Brain repo and the existing Claude/Codex workflow on this Mac.

It is intentionally not a general-purpose agent platform. The goal is fast remote access to trusted local workflows with a small, auditable codebase and low idle resource usage.

## Goals

- Slack-first remote control with Telegram as a fallback
- Brain-aware file and note workflows
- Claude/Codex session overview and summarization
- Safe local execution with allowlisted roots and confirmation gates
- Low idle CPU and memory footprint

## MVP Scope

- Telegram bot via long polling
- Slack bot via Socket Mode DM commands
- User ID allowlist
- Local SQLite state for approvals and event logging
- Session overview for Claude and Codex
- Optional local dashboard with machine, session, scheduler, and AI usage status
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
- `/home` — unified remote-control overview
- `/recent` — best 5 resumable sessions, ranked for a small screen
- `/focus <repo>` — fast context and continuation view for one repo
- `/status` — daemon health and machine summary
- `/sessions [repo]` — recent Claude, Codex, and Gemini sessions, optionally filtered by repo
- `/summary [today|week]` — compact session digest
- `/jobs` — list pending approvals
- `/approve <id>` — approve a pending action
- `/reject <id>` — reject a pending action
- `/tail [target]` — inspect recent local logs, including ProBot and scheduler logs
- `/report [scheduler]` — read the latest local scheduler report
- `/run restart-probot` — request an approval-gated local ProBot restart
- `/ssh [repo]` — SSH + tmux continuation guidance
- `/continue <repo|1-5>` — guided continuation by repo or recent-session number
- `/note <text>` — save a text note
- `/brain <query>` — search the Brain repo
- `/find <query>` — search files by name and content
- `/send <absolute-path>` — request approval to send a file

Slack DM commands currently supported:

- `help`
- `home`
- `recent`
- `focus <repo>`
- `status`
- `sessions [repo]`
- `summary [today|week]`
- `jobs`
- `approve <id>` / `reject <id>`
- `report [scheduler]`
- `repos`
- `handoff <repo>`
- `resume <repo>`
- `continue <repo|1-5>`
- `tail [target]`
- `run restart-probot`
- `ssh [repo]`
- `dashboard`

## Slack Integration

### Supported path: Slack API runtime

ProBot's actual Slack bot runs through Bolt with:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_ALLOWED_USER_IDS`

This is the only supported Slack path for ProBot. It uses the existing Slack app and does not depend on the Slack CLI.

## Local Run

Preferred secret location:

- `~/.config/probot/.env`

Fallback for local development:

- `projects/probot/.env`

1. Copy `.env.example` to `~/.config/probot/.env`
2. Fill in your Telegram token and allowed user ID
3. Optionally fill in Slack bot/app tokens and allowed user IDs
4. Run `npm install`
5. Run `npm run dev`

ProBot will load env vars in this order:

1. `PROBOT_ENV_FILE` if set and present
2. `~/.config/probot/.env`
3. local `.env` in `projects/probot/`

Slack behavior:

- if `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are present, ProBot starts Slack Socket Mode
- if they are missing, Slack is simply disabled and Telegram continues to work
- this makes Telegram a safe fallback path while Slack is being iterated on

## Production Run

- `npm run build`
- `npm run start`
- Install the launchd agent with `./scripts/install-launchd.sh`

## Recommended Operating Model

Use the channels for different jobs:

- Slack: primary control plane for status, repo handoffs, approvals, and task triggers
- Telegram: backup channel if Slack auth or workspace availability becomes a problem
- SSH + `tmux` over Tailscale: real remote CLI continuation for Claude, Codex, and Gemini

Current bounded operational action:

- `run restart-probot` creates an approval-gated restart request for the local `launchd` agent

Do not try to turn Slack into a full terminal. Use it to orchestrate work, not to replace shell access.

Recommended fast path from outside the house:

1. `home` to see the latest active sessions, repo state, and pending approvals
2. `recent` to get the best 5 resumable sessions in a phone-friendly numbered list with short `intent · repo` tags and an explicit `Suggested next action`
3. `continue 1` through `continue 5` to select the exact session you want
4. `focus <repo>` if you want repo context before continuing
5. `ssh <repo>` if you only need the Moshi-friendly SSH + tmux steps
6. `report scheduler` or `tail scheduler` if you need runtime observability before attaching

The guided resume output now includes a one-command helper you can run after `ssh office`:

- `~/Repos/stevewesthoek/brain/tools/scripts/probot-continue.sh "<repo-path>" auto`

That helper creates or reattaches a stable tmux session per repo and resumes the latest Claude, Codex, or Gemini session it can find for that repo. When ProBot gives you a numbered `continue 1` style path, it also passes the exact resume target so you land in the intended session instead of the generic latest one. The numbered list is ranked to prefer live tmux sessions and repos with fresher handoffs before falling back to plain recency, and each candidate now includes a short `intent · repo` tag such as `deploy · proofly`, `ops · probot`, or `analytics · brain`, plus an explicit `Suggested next action` line so it is obvious what ProBot recommends you do next.

The suggestion format is intentionally standardized:

- ranked lists like `home` and `recent` suggest `continue <n>`
- repo-focused views like `focus <repo>` suggest `resume <repo>`

That way the command shape stays predictable and you do not need to think about which verb to use in each context.

The `home` Slack command returns structured Block Kit messages rather than a plain text code block: a status header, one section per top-5 session with tool/repo/intent/age and the suggested command, and a footer with quick-access commands. This renders cleanly on mobile without horizontal scrolling.

The dashboard reuses the same continuation ranking and suggestion logic, with a tab-based layout:

- **Metrics bar** — always-visible top row: CPU, Memory, Uptime, Host, Codex 5h, Codex 7d in one compact row
- **Tabs** — Sessions | Repositories | New Relic | Scheduler; one section visible at a time, no full-page scroll
- **Sessions tab** — best next sessions as a 3-column card grid (same layout as Repositories)
- each card shows the tool badge, repo, intent label, age, truncated headline, and the suggested `continue N` command
- **Open in Ghostty** copies the command to clipboard and opens Ghostty; uses TCP socket address detection so it works when the dashboard is accessed through a Cloudflare tunnel or reverse proxy as well as direct localhost
- **Copy** copies the suggested command to clipboard; works on HTTPS and HTTP contexts

## Dashboard AI Usage

When the local dashboard is enabled, the Codex usage cards are sourced from Codex's own local session-log `token_count.rate_limits` events rather than from a hard-coded estimate.

Behavior:

- ProBot passively reads the latest Codex rate-limit snapshot from `~/.codex/sessions/**/*.jsonl`
- it caches the latest resolved 5-hour and 7-day windows in `projects/probot/data/codex-usage.json`
- it runs a lightweight background refresh check every 5 minutes
- it only forces a tiny Codex probe when the cached usage window has expired or there is no usable fresh snapshot

This keeps the dashboard near real time without continuously spending tokens on synthetic prompts.

## Dashboard Stripe Model

The ProBot dashboard's Stripe work should follow the canonical runbook:

- `operations/runbooks/stripe-cli-and-probot.md`

Key rule:

- ProBot should inspect Stripe by local CLI profile, not by assuming one main Stripe account can enumerate every other dashboard-visible account.

In this workspace:

- each live Stripe account can have both live and test access in the same CLI profile
- a separate sandbox profile only exists when Stripe exposes one explicitly
- the current profile and account inventory is indexed at `operations/accounts/credentials-index.md`

For implementation and debugging:

- verify the account context with `stripe get /v1/account -p <profile>`
- inspect configured profiles via `~/.config/stripe/config.toml`
- preserve the existing `default` Says the Bible profile unless explicitly told to change it

## Notes Storage

By default, notes are written under:

- `projects/probot/inbox/YYYY/YYYY-MM-DD.md`

This keeps capture local to the ProBot project until you decide which captured items should be promoted into more canonical Brain locations.

## Main Docs

- [SPEC.md](./SPEC.md)
- [.env.example](./.env.example)
