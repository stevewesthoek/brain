---
name: rtk
description: Use RTK to reduce shell-command token output for coding agents. Prefer RTK for git, search, file listing, tests, builds, lint, logs, Docker, and other noisy CLI output; use raw commands only when exact full output is required.
---

# RTK

## What it is

RTK (Rust Token Killer) is a local CLI proxy that runs normal developer commands and returns compact, agent-friendly output. It reduces token spend from noisy shell commands while preserving the information usually needed for coding work.

Installed binary:

```bash
rtk --version
rtk gain
```

## When to use

Use RTK for shell commands that commonly produce noisy output:

- `git status`, `git diff`, `git log`, `git pull`, `git push`
- `ls`, `find`, `tree`, `rg`, `grep`, `cat`, `head`, `tail`
- test runners such as `npm test`, `pnpm test`, `pytest`, `cargo test`, `go test`, `playwright test`
- build and lint commands such as `npm run build`, `pnpm lint`, `tsc`, `next build`, `ruff`, `shellcheck`
- logs and infrastructure views such as `docker ps`, `docker logs`, `kubectl`, `aws logs`

Prefer RTK by default in AI/LLM CLI sessions because terminal output enters model context.

## How to use

Prefix noisy commands with `rtk`:

```bash
rtk git status
rtk git diff
rtk rg "pattern" .
rtk npm test
rtk docker ps
```

Use RTK meta commands directly:

```bash
rtk gain
rtk gain --history
rtk discover
rtk proxy <command>
```

Use `rtk proxy <command>` or the raw command when exact unfiltered output is needed for:

- security-sensitive inspection where every line matters
- debugging RTK filtering itself
- commands whose compact output hides necessary context
- copy/paste output that must be byte-for-byte accurate

## Engine behavior

- Claude Code: Bash commands are routed through `~/.claude/hooks/rtk-safe-bash-hook.sh`, which runs the brain risky-command guard first, then RTK rewriting.
- Gemini CLI: shell commands are routed through the Gemini `BeforeTool` hook when supported by Gemini settings.
- Codex: prefer explicit `rtk` prefixes in shell commands. Codex hook support is not assumed in this brain config.

## Safety rules

- RTK must not replace guardrails. Destructive, deploy, credential-sensitive, database, financial, or external-state mutations still require the normal confirmation policy.
- Do not use RTK to hide important command output. If compact output is ambiguous, rerun the specific command with `rtk proxy` or the raw command.
- Do not store secrets in RTK output, logs, examples, or documentation.

## Verification

```bash
which rtk
rtk --version
rtk gain
rtk hook check "git status"
```

Claude hook check:

```bash
printf '%s' '{"tool_input":{"command":"git status"}}' \
  | bash ~/.claude/hooks/rtk-safe-bash-hook.sh
```

Expected: command rewrites to `rtk git status`.

Risk guard check:

```bash
printf '%s' '{"tool_input":{"command":"rm -rf /tmp/foo"}}' \
  | bash ~/.claude/hooks/rtk-safe-bash-hook.sh
```

Expected: confirmation is requested; the command is not silently rewritten or allowed.

## Uninstall

See `brain/operations/runbooks/rtk.md` for full uninstall and rollback steps.
