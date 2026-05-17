# ProBot

> Migration note: ProBot is being reduced to an optional thin client over Brain Core. Do not add new dashboard product features here. New machine/session/scheduler surfaces should be implemented in `projects/brain-core` first, then consumed by Slack/Telegram only as fallback/mobile clients.

ProBot is a lightweight, always-on local Slack and Telegram control plane for the Brain repo and the existing Claude/Codex workflow on this Mac.

It is being trimmed into a thin read-only client over Brain Core. New machine, session, scheduler, approval, and runtime-report surfaces should come from Brain Core first.

It is intentionally not a general-purpose agent platform. The goal is fast remote access to trusted local workflows with a small, auditable codebase and low idle resource usage.

## Architecture Direction — Dashboard Freeze

As of 2026-05-16, the ProBot dashboard is deprecated as a primary product UI.

The accepted direction is documented in:

- `../../docs/system/obsidian-brain-core-roadmap.md`
- `../../docs/system/obsidian-brain-core-implementation-plan.md`

Obsidian is the target primary human cockpit. ProBot should not receive new dashboard product features. Reusable ProBot backend capabilities may be migrated into the future Brain Core local API, including Slack/Telegram adapters, session ranking, local app lifecycle logic, approval handling, and selected status adapters.

Dashboard changes are allowed only when they support diagnostics, migration, or safe decommissioning.

Brain Console is expected to live as a standalone Obsidian plugin project outside the live Mind vault and remain manually installable only after explicit approval.

Desired read-only Brain Core command aliases for the thin-client direction are:

- `brain`
- `brain status`
- `brain reports`
- `brain sessions`
- `brain approvals`

These should remain GET-only and fail soft when Brain Core is offline.

They are now wired through the Slack DM text path and Telegram `message:text` path as a small read-only escape hatch, not as a new dashboard surface.

## Current Direction: Dashboard Freeze

The ProBot dashboard is deprecated as a primary UI. Obsidian is the target primary human cockpit, backed by a small local Brain Core API.

Canonical roadmap:

- `../../docs/system/obsidian-brain-core-roadmap.md`
- `../../docs/system/obsidian-brain-core-implementation-plan.md`

Do not add new product dashboard features here. During migration, ProBot may provide reusable backend capabilities such as Slack/Telegram adapters, session ranking, local app lifecycle logic, approvals, and selected status adapters. New dashboard or machine-control work should target Brain Core and Obsidian.

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
- Local Apps dashboard with registry-driven start, stop, and restart controls
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
- **Tabs** — Sessions | Dokploy | New Relic | Scheduler | Analytics | Google Ads | Stripe | Mutations | Domains; one section visible at a time, no full-page scroll
- **Sessions tab** — best next sessions as a card grid
  - each card shows the tool badge, repo, intent label, age, multi-line headline, and the suggested `continue N` command
  - **Open in Ghostty** button opens Ghostty, `cd`s to the repo, and automatically resumes the session; uses TCP socket address detection so it works when the dashboard is accessed through a Cloudflare tunnel or reverse proxy as well as direct localhost

### Local Apps dashboard contract

The Local Apps tab is registry-driven and should stay uniform across all onboarded apps:

- every app has a `startCommand`
- every app should have a `stopCommand` when clean shutdown is possible
- apps that need special lifecycle handling may define a `restartCommand`
- the dashboard restart action is generic and should defer to `restartCommand` when present
- if no `restartCommand` exists, ProBot falls back to the shared stop-clean-start flow
- restart is only shown for running apps, because the control is meant to restart an already-running service

When adding new apps to the dashboard, prefer repo-local helper scripts over embedding app-specific restart logic in ProBot itself.

### Dashboard Dokploy Tab

ProBot monitors all Dokploy deployments (applications and Docker Compose services) across all projects and environments.

**Features:**

- **Deployment grid** — Shows all applications and services with color-coded status indicators
  - 🟢 **Green (done)** — healthy, running as expected
  - 🔵 **Blue (running)** — currently deploying or starting
  - 🔴 **Red (failed/error)** — deployment failed, needs attention
  - ⚫ **Gray (stopped/idle)** — not currently running
- **Smart sorting** — errors and building deployments appear first (top row, leftmost), followed by idle, stopped, and healthy deployments
- **Full context** — each card shows application name, project, environment, and status
- **Real-time updates** — refreshes every 30 seconds to reflect deployment changes
- **Responsive design** — 3-column grid on desktop, 2 on tablet, 1 on mobile

The tab is sourced from Dokploy's `/api/project.all` endpoint using credentials stored in `~/.config/dokploy/.env` (same credentials used by the `dokploy` CLI).

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

Current dashboard behavior:

- the Stripe tab renders one account card per indexed Stripe profile/account
- each card shows live, test, and optional dedicated sandbox contexts separately
- each context includes balances, recent successful charge totals, refund totals, product count, price count, subscription count, customer count, top products, and subscription status breakdown
- raw Stripe account and balance payloads are available behind collapsible debug sections for inspection
- data is cached briefly inside ProBot to avoid re-querying Stripe on every dashboard refresh

For implementation and debugging:

- verify the account context with `stripe get /v1/account -p <profile> --live` for live mode
- verify test mode with `stripe get /v1/account --api-key <test_mode_api_key>`
- inspect configured profiles via `~/.config/stripe/config.toml`
- preserve the existing `default` Says the Bible profile unless explicitly told to change it

## Notes Storage

By default, notes are written under:

- `projects/probot/inbox/YYYY/YYYY-MM-DD.md`

This keeps capture local to the ProBot project until you decide which captured items should be promoted into more canonical Brain locations.

## Main Docs

- [SPEC.md](./SPEC.md) — Technical architecture and runtime model
- [SESSIONS-AND-ACCESSIBILITY.md](./SESSIONS-AND-ACCESSIBILITY.md) — **⚠️ READ THIS**: How sessions work, the "Open in Ghostty" feature, and why macOS Accessibility shows "node" instead of "ProBot"
- [.env.example](./.env.example)
