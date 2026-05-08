# Skill Profile Activation Runbook

**Purpose:** Safely reduce the active skill surface while preserving every source skill and every orchestrator reference.

---

## Current State

The repo previously exposed 119 active skill entries through `ai/skills/active/`.

The new profile system adds:

- compact default profile
- domain profiles
- recovery profile
- skill index
- conservative switcher script

No source skills were deleted, renamed, or merged.

---

## Files Created

Profiles:

```text
docs/skills/profiles/default.txt
docs/skills/profiles/video.txt
docs/skills/profiles/design.txt
docs/skills/profiles/deploy.txt
docs/skills/profiles/research.txt
docs/skills/profiles/full-current.txt
```

Docs:

```text
docs/skills/skill-loading-architecture.md
docs/skills/skill-index.md
docs/skills/profile-activation-runbook.md
```

Script:

```text
tools/scripts/switch-skill-profile.mjs
```

---

## Safety Policy

The switcher:

- does not delete source skills
- does not rename source skills
- changes only `ai/skills/active/`
- refuses to remove real files or directories from `ai/skills/active/`
- requires all profile skills to resolve before applying
- backs up the current active list before applying
- runs `sync-ai-skills.mjs` and `sync-ai-skills.mjs --check` after applying

---

## Important Note About `.md` Active Entries

Some active entries may be real files rather than symlinks, for example:

```text
ai/skills/active/notebooklm.md
```

`playwright` has been converted to the standard folder-based skill shape:

```text
ai/skills/custom/playwright/SKILL.md
ai/skills/active/playwright -> ../custom/playwright
```

The switcher intentionally refuses to remove non-symlink entries. This prevents data loss.

If a profile switch fails because of non-symlink active entries, inspect those files manually and decide whether they should be converted into proper source skills under `ai/skills/custom/` and symlinked from `active/`.

Do not delete them blindly.

---

## Preview a Profile Switch

```bash
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
```

Expected result:

- validates every profile skill resolves to a source path
- shows which active entries would be removed
- shows which entries would be added
- makes no changes

---

## Apply a Profile

```bash
node tools/scripts/switch-skill-profile.mjs default --apply --verbose
```

The script will then call:

```bash
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

This verifies Claude Code, Codex, Gemini CLI, Cursor, Kiro, and Antigravity all see the same active skill set.

---

## Check a Profile

```bash
node tools/scripts/switch-skill-profile.mjs default --check
```

This exits non-zero if `ai/skills/active/` does not exactly match the profile.

---

## Restore Original Active Surface

```bash
node tools/scripts/switch-skill-profile.mjs full-current --apply --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

`full-current.txt` is a recovery snapshot of the original 119 active entries observed on 2026-05-08.

---

## Recommended Rollout

1. Run dry run:

```bash
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
```

2. If it reports non-symlink active entries, convert those entries into proper source skills first.

3. Apply default profile:

```bash
node tools/scripts/switch-skill-profile.mjs default --apply --verbose
```

4. Verify consumers:

```bash
node tools/scripts/sync-ai-skills.mjs --check
```

5. Test natural language flows:

```text
Design a landing page for my SaaS.
Create a video package for TikTok and YouTube.
Review this code change.
Deploy this safely.
Research this topic and summarize sources.
```

---

## Orchestrator Integrity

The following orchestrators were updated to support dormant subskills:

- `ai/skills/custom/video/SKILL.md`
- `ai/skills/custom/design/SKILL.md`
- `ai/skills/custom/code/SKILL.md`

They now instruct agents to use:

```text
docs/skills/skill-index.md
docs/skills/profiles/*.txt
```

when a needed subskill is not active in the default profile.

---

## Definition of Done

The profile system is fully active when:

- default profile dry-run passes
- default profile apply succeeds
- `sync-ai-skills.mjs --check` passes
- high-level natural-language orchestrator flows still work
- `full-current` restore has been verified at least once in dry-run mode

---

## What Not To Do

- Do not delete source skills.
- Do not rename subskills without updating orchestrators and profiles.
- Do not merge many skills into a giant monolithic skill.
- Do not bypass the switcher by manually copying skills to consumer folders.
- Do not remove real files from `ai/skills/active/` without first preserving their source content.
