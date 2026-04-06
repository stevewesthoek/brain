---
name: brain-new-ai-tool-integration
description: When adding a new AI CLI tool to brain (operations/system-configs/), the runtime directory mixes safe config with secret-bearing files in the same folder — missing explicit gitignore entries silently leaves OAuth tokens untracked and outside hook protection.
---

# Brain — New AI Tool Integration Checklist

## The insight

Each AI CLI tool (Claude, Codex, Gemini, Kiro...) stores its runtime state under `brain/operations/system-configs/<tool>/`. These directories mix two classes of files:

- **Safe to commit or gitignore:** `settings.json`, `projects.json`, `trustedFolders.json`, `SKILL.md`
- **Must never be committed:** `oauth_creds.json`, `state.json`, `google_accounts.json`, `installation_id`, `history/`, `tmp/`

The dangerous property: they look identical in `git status` — both show as `??` untracked. You cannot pattern-match the whole directory safe because some files (config, SKILL.md) belong in the repo. You need explicit per-file gitignore entries for the secret-bearing ones.

The second gap: `check-sensitive-edit.sh` and `check-risky-command.sh` have hardcoded filename patterns (`.pem`, `.key`, `id_rsa`, `.env`). A new tool's secret files (`oauth_creds.json`, `google_accounts.json`) won't match those patterns — they're outside hook protection until explicitly added.

## When this applies

- `git status` shows `??` files in `operations/system-configs/<new-tool>/`
- A new AI CLI (Gemini, Kiro, Cursor, etc.) has just been added to brain
- You see untracked files after a tool first runs and writes its auth state

## The approach

1. **Read the directory** — don't assume, look at what the tool actually wrote
2. **Classify each file:** is it config (can commit) or runtime/auth (must not commit)?
3. **Gitignore secrets explicitly** — never glob the whole tool dir
4. **Extend hook patterns** — add the tool's secret filenames to both hook scripts

## The fix

**Step 1 — Classify untracked files:**
```bash
ls operations/system-configs/<tool>/
# read suspicious files (oauth*, *creds*, state*, *accounts*) to confirm they're secret
```

**Step 2 — Add explicit gitignore entries** in the "tool runtime" section of `.gitignore`:
```
# <Tool> CLI runtime state and secrets (never commit)
operations/system-configs/<tool>/oauth_creds.json
operations/system-configs/<tool>/state.json
operations/system-configs/<tool>/<accounts-file>.json
operations/system-configs/<tool>/installation_id
operations/system-configs/<tool>/history/
operations/system-configs/<tool>/tmp/
# safe to either gitignore or commit:
operations/system-configs/<tool>/settings.json
operations/system-configs/<tool>/projects.json
```

**Step 3 — Extend hook coverage** in both hook scripts:

`check-sensitive-edit.sh` — add to the credential file case:
```bash
*"oauth_creds"*|*"oauth-creds"*|*"_accounts.json"*|*"client_secret"*
```

`check-risky-command.sh` — add to section 4 grep pattern:
```
[^[:space:]]*oauth_creds|[^[:space:]]*oauth-creds|[^[:space:]]*_accounts\.json|[^[:space:]]*client_secret[^[:space:]]*\.json
```

**Step 4 — Run the hook smoke test:**
```bash
bash tools/scripts/check-hooks.sh
```

## Gotchas

- `workspace.json` (Obsidian), `settings.json` (Gemini), `projects.json` — these are runtime state but contain no secrets. Gitignore them to avoid noise, but they won't cause a security breach if accidentally committed.
- `oauth_creds.json` and `state.json` contain live OAuth tokens. A single accidental commit and push exposes them in git history even after deletion — treat as critical.
- Hook patterns only protect interactive Claude sessions. Codex and Gemini have no equivalent hook layer — gitignore is the only protection for those engines.
- Run `bash tools/scripts/check-hooks.sh` after any hook script change to verify coverage is intact.

## Context

Repo: brain  
Discovered: 2026-04-06  
Area: operations/system-configs/, operations/system-configs/claude/hooks/
