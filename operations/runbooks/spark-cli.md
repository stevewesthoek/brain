# Spark CLI Installation & Configuration

## Overview

Spark CLI is a command-line interface for the Spark email client. It allows querying mailbox data, calendar, contacts, meetings, and team information through a unified CLI.

This document describes the **universal installation** of Spark CLI across all AI/IDE consumers in the machine-brain system:
- Claude Code
- Codex
- Gemini CLI
- Kiro
- Cursor
- Antigravity

## Installation Architecture

The installation follows the **system-wide stable wrapper pattern** used for other CLIs (aws-cli, azure-cli, n8n-api, etc.).

### Directory Structure

```
brain/
├── operations/system-configs/
│   └── bin/
│       └── spark-cli              ← stable wrapper script (symlinked from ~/.local/bin)
└── ai/skills/
    ├── custom/
    │   └── spark/
    │       └── SKILL.md            ← skill documentation (from spark skill)
    └── active/
        └── spark → ../custom/spark ← symlink activated for all consumers
```

### Entry Points

| Tool | Entry Point | Resolution |
|------|-------------|-----------|
| Claude Code | `spark-cli` in PATH | `~/.local/bin/spark-cli` → `operations/system-configs/bin/spark-cli` → `/usr/local/bin/spark` |
| Codex | `spark-cli` in PATH | same as above |
| Gemini CLI | `spark-cli` in PATH | same as above |
| Kiro | `spark` skill via symlink | `operations/system-configs/kiro/skills/spark` → `ai/skills/active/spark` |
| Cursor | `spark` skill via symlink | `operations/system-configs/cursor/skills/spark` → `ai/skills/active/spark` |
| Antigravity | `spark` skill via symlink | `operations/system-configs/gemini/antigravity/skills/spark` → `ai/skills/active/spark` |

## Wrapper Script

**File:** `operations/system-configs/bin/spark-cli`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Stable local entrypoint for Spark CLI usage across Claude Code, Codex, Gemini CLI, Kiro, Cursor, and Antigravity.
# Spark CLI is an IPC-based client for the Spark Desktop email app.
# Default path matches the current machine; override only for debugging.

spark_bin="${SPARK_CLI_BIN:-/usr/local/bin/spark}"

exec "${spark_bin}" "$@"
```

**Why this pattern?**
- `SPARK_CLI_BIN` environment variable allows overriding the binary path for debugging or testing
- Single source of truth for all CLI invocations across multiple AI/IDE consumers
- Isolates the system wrapper from Spark Mail's conflicting `/usr/local/bin/spark` (which is actually a symlink to Spark Mail's desktop executable)
- Portable: consumer tool configs only reference `spark-cli`, not the underlying binary

## Skill Installation

The Spark skill is installed in two locations:

### 1. Custom Source
**File:** `ai/skills/custom/spark/SKILL.md`

Contains the full skill documentation extracted from the Spark CLI (`spark skill` command output). This is the canonical source.

**Size:** ~40KB (comprehensive email/calendar/contact operations reference)

**Version:** Matches Spark Desktop version (currently 1.1.0)

### 2. Active Symlink
**File:** `ai/skills/active/spark → ../custom/spark`

Activated symlink that makes the skill visible to all AI/IDE consumers via the skill sync system.

## How It's Distributed to All Consumers

The `sync-ai-skills.mjs` script distributes activated skills to all consumers:

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run  # preview changes
node tools/scripts/sync-ai-skills.mjs             # apply changes
node tools/scripts/sync-ai-skills.mjs --check     # verify sync
```

**Distribution:**

| Consumer | Sync Mode | Result |
|----------|-----------|--------|
| Claude Code | root-symlink | `~/.claude/skills` → `ai/skills/active` |
| Codex | root-symlink | `~/.codex/skills/user` → `ai/skills/active` |
| Gemini CLI | root-symlink | `~/.gemini/skills` → `ai/skills/active` |
| Cursor | root-symlink | `operations/system-configs/cursor/skills` → `ai/skills/active` |
| Kiro | entry-symlinks | `~/.kiro/skills/spark` → `ai/skills/active/spark` |
| Antigravity | root-symlink | `operations/system-configs/gemini/antigravity/skills` → `ai/skills/active` |

All consumers can now see the Spark skill at the top-level path (e.g., `~/.claude/skills/spark/SKILL.md` for Claude Code).

## CLI Usage

### From Claude Code, Codex, or Gemini CLI

```bash
spark-cli emails                                 # list emails
spark-cli search "topic"                         # semantic search
spark-cli thread 1234                            # read full thread
spark-cli availability --tomorrow                # check availability
spark-cli accounts                               # list accounts with access levels
```

The wrapper resolves to `/usr/local/bin/spark`, which is the Spark Desktop CLI binary.

### From Kiro, Cursor, or Antigravity

Use the **`/use-spark` skill** instead:

1. Skills can be triggered with `/` prefix
2. Mention email/calendar/contact queries naturally
3. The skill automatically invokes the underlying Spark CLI

Example prompts:
- "Search my emails for the Q2 budget report"
- "Find available meeting time tomorrow with alice@co.com"
- "Show me unread emails from the past week"

## Requirements

### Runtime Requirements
- **Spark Desktop app must be running** — Spark CLI is an IPC client only
- **Mac OS only** — Spark Desktop is macOS-exclusive
- **Direct desktop session access** — cannot run in sandboxes, containers, or remote sessions

### CLI Binary
- Spark CLI binary: `/usr/local/bin/spark` (installed with Spark Desktop)
- Version: 1.1.0 (current) — newer versions may be backwards-compatible

### Skill Version Tracking
- `metadata.version` in `SKILL.md` tracks the CLI version
- CLI and skill versions must match
- Update the skill when Spark Desktop updates the CLI version (see "Updating" section)

## Access Levels

Spark configures per-account access levels in Spark Desktop:

| Level | Allowed Operations |
|-------|-------------------|
| **read-only** | List, search, read emails, threads, folders, events, contacts, meetings, teams |
| **triage** | read-only + drafts, comments, email actions (archive, pin, snooze, assign, etc.) |

Access levels are configured per account and per shared inbox under Settings → AI Agents in Spark Desktop.

## Updating the Skill

When Spark Desktop updates, the embedded skill may also update. To check if the skill needs updating:

```bash
spark --version                    # current CLI version
grep "version:" ai/skills/custom/spark/SKILL.md  # skill version in metadata
```

If CLI version > skill version, refresh the skill:

```bash
spark skill > /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/spark/SKILL.md
git add ai/skills/custom/spark/SKILL.md
git commit -m "Update Spark skill to version $(spark --version | awk '{print $NF}')"
```

Then re-sync skills:
```bash
node tools/scripts/sync-ai-skills.mjs --check
```

## Troubleshooting

### "Error: Spark Desktop is not running"
Spark CLI requires the Spark Desktop app to be running. Launch Spark Desktop and retry.

### "Permission denied: spark-cli"
The wrapper script is not executable. Fix with:
```bash
chmod +x /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/spark-cli
```

### spark-cli not found in PATH
Ensure `~/.local/bin` is in your `PATH`:
```bash
echo $PATH | grep -q "$HOME/.local/bin" || echo "~/.local/bin not in PATH"
```

If missing, add to shell profile (`.zshrc` / `.bashrc`):
```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Skill appears in one consumer but not another
Run the sync check:
```bash
node tools/scripts/sync-ai-skills.mjs --check
```

If it fails, run the full sync:
```bash
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

### "IPC connection failed" / "access denied"
Spark CLI uses inter-process communication (IPC) to reach Spark Desktop. It cannot:
- Run in containers or sandboxes
- Run on remote machines
- Run in CI/CD environments

It must run directly on your Mac against the running Spark Desktop process.

## Common Commands

See `ai/skills/custom/spark/SKILL.md` for the full reference. Quick commands:

```bash
spark-cli accounts                                  # list accounts
spark-cli folders                                   # list folders
spark-cli emails                                    # list inbox
spark-cli emails --filter "from:alice is:unread"   # filtered list
spark-cli search "topic"                            # semantic search with bodies
spark-cli thread 1234                               # read full thread
spark-cli events --week                             # calendar this week
spark-cli availability --tomorrow --attendees alice@co.com  # find free time
spark-cli contacts "name or email"                  # search contacts
spark-cli team "Team Name"                          # team info
spark-cli draft --to alice@co.com --subject "Hi" --body "Message"  # compose
spark-cli comment 1234 --body "Looks good!"        # post team comment
spark-cli action archive 1234 5678                  # archive emails
spark-cli action assign 1234 --assignee bob@co.com  # assign to teammate
```

## Maintenance

### Symlink Health Check
```bash
ls -la ~/.local/bin/spark-cli
ls -la /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/spark
```

Both should be symlinks pointing to the correct targets.

### Wrapper Script Permissions
```bash
ls -l /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/spark-cli
# Should show: -rwxr-xr-x (755)
```

### Version Alignment
```bash
spark --version
grep 'version:' /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/spark/SKILL.md | head -1
```

Should show the same version number.

## Reference

- **Spark Desktop website:** https://sparkmailapp.com
- **Skill reference:** See `ai/skills/custom/spark/SKILL.md` (in this repo)
- **Wrapper pattern:** Used for aws-cli, n8n-api, azure-cli, etc. in `operations/system-configs/bin/`
- **Skill sync system:** `tools/scripts/sync-ai-skills.mjs`
- **Brain documentation:** `CLAUDE.md` section "Universal capability install"
