# RTK Runbook

RTK (Rust Token Killer) is installed as the shared shell-output compression layer for AI coding sessions.

## Purpose

RTK reduces token spend from noisy CLI output. It does not route models, replace Firecrawl/Gemini preprocessing, or relax guardrails.

Use it for shell-heavy coding loops:

```bash
rtk git status
rtk git diff
rtk rg "pattern" .
rtk npm test
rtk docker logs <container>
```

## Installed Components

- Binary: `/opt/homebrew/bin/rtk` via Homebrew
- Shared skill: `ai/skills/custom/rtk/SKILL.md`
- Active skill symlink: `ai/skills/active/rtk`
- Claude safe wrapper: `operations/system-configs/claude/hooks/rtk-safe-bash-hook.sh`
- Claude hook registration: `operations/system-configs/claude/settings.json`
- Codex awareness file: `operations/system-configs/codex/RTK.md`
- Codex awareness reference: `@/Users/Office/.codex/RTK.md` in `operations/system-configs/codex/AGENTS.md`
- Gemini hook wrapper: `operations/system-configs/gemini/hooks/rtk-hook-gemini.sh`
- Gemini hook registration: `operations/system-configs/gemini/settings.json`
- Engine docs: `CLAUDE.md`, `operations/system-configs/claude/CLAUDE.md`, `operations/system-configs/codex/AGENTS.md`, `operations/system-configs/gemini/GEMINI.md`

## Claude Code Integration

Claude uses a safe wrapper:

```bash
bash ~/.claude/hooks/rtk-safe-bash-hook.sh
```

Order:

1. Run `check-risky-command.sh`.
2. If the guard asks/allows with notice, return that decision immediately.
3. If ordinary safe allow, run `rtk hook claude`.
4. If RTK has a rewrite, return the rewritten command.
5. If RTK has no rewrite, allow the original command.

This preserves the brain guardrails before any token optimization.

Note: `rtk gain` or `rtk init --show` may warn that no standard Claude hook is installed, because brain intentionally uses a custom safe wrapper instead of registering `rtk hook claude` directly. Treat `rtk-safe-bash-hook.sh` verification as the source of truth for Claude integration.

## Gemini CLI Integration

Gemini uses a `BeforeTool` hook for `run_shell_command`:

```json
"hooks": {
  "BeforeTool": [
    {
      "matcher": "run_shell_command",
      "hooks": [
        {
          "type": "command",
          "command": "/Users/Office/.gemini/hooks/rtk-hook-gemini.sh"
        }
      ]
    }
  ]
}
```

The wrapper delegates to:

```bash
rtk hook gemini
```

## Codex Integration

Codex currently uses explicit command discipline rather than an RTK hook in this brain config. Codex should prefix noisy shell commands with `rtk`, for example:

```bash
rtk git status
rtk rg "pattern" .
rtk npm test
```

Use raw commands or `rtk proxy` when exact output is required.

## Verification

Binary:

```bash
which rtk
rtk --version
rtk gain
```

Rewrite dry run:

```bash
rtk hook check "git status"
rtk hook check "rm -rf /tmp/foo"
```

Claude wrapper:

```bash
printf '%s' '{"tool_input":{"command":"git status"}}' \
  | bash ~/.claude/hooks/rtk-safe-bash-hook.sh

printf '%s' '{"tool_input":{"command":"rm -rf /tmp/foo"}}' \
  | bash ~/.claude/hooks/rtk-safe-bash-hook.sh
```

Expected:

- `git status` rewrites to `rtk git status`
- recursive delete returns the brain confirmation prompt

Skill sync:

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

## Telemetry

RTK telemetry is opt-in according to its docs. Keep it disabled unless explicitly approved.

Check:

```bash
rtk telemetry status
```

Disable:

```bash
rtk telemetry disable
export RTK_TELEMETRY_DISABLED=1
```

## Uninstall And Restore

Disable Claude integration:

1. Edit `operations/system-configs/claude/settings.json`.
2. Change the Bash PreToolUse command from:

```json
"command": "bash /Users/Office/.claude/hooks/rtk-safe-bash-hook.sh"
```

back to:

```json
"command": "bash /Users/Office/.claude/hooks/check-risky-command.sh"
```

3. Remove `operations/system-configs/claude/hooks/rtk-safe-bash-hook.sh`.

Disable Gemini integration:

1. Edit `operations/system-configs/gemini/settings.json`.
2. Remove the `hooks.BeforeTool` entry whose command contains `rtk-hook-gemini.sh`.
3. Remove `operations/system-configs/gemini/hooks/rtk-hook-gemini.sh`.

Disable shared skill:

```bash
rm ai/skills/active/rtk
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

Disable Codex awareness:

1. Remove `@/Users/Office/.codex/RTK.md` from `operations/system-configs/codex/AGENTS.md`.
2. Remove `operations/system-configs/codex/RTK.md`.

Remove the binary:

```bash
brew uninstall rtk
```

Optional: remove local RTK tracking data after exporting anything useful:

```bash
rtk gain --all --format json > /tmp/rtk-savings.json
rtk gain --reset
```

If `rtk` is already uninstalled and you still want to remove local state manually, check RTK's platform-specific data directory first. On macOS, RTK documents local tracking under `~/Library/Application Support/rtk/`.

## Rollback Commit Strategy

RTK integration is intentionally isolated. A rollback should touch only:

- `ai/skills/custom/rtk/`
- `ai/skills/active/rtk`
- `operations/runbooks/rtk.md`
- `operations/system-configs/claude/hooks/rtk-safe-bash-hook.sh`
- `operations/system-configs/claude/settings.json`
- `operations/system-configs/gemini/hooks/rtk-hook-gemini.sh`
- `operations/system-configs/gemini/settings.json`
- RTK references in `CLAUDE.md`, `operations/system-configs/claude/CLAUDE.md`, `operations/system-configs/codex/AGENTS.md`, and `operations/system-configs/gemini/GEMINI.md`
