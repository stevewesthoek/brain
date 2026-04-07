# Skills

Canonical home for shared skills across tools (Claude Code, Codex, etc.).

## Structure

```
skills/
├── active/    # Symlinks only — what Claude reads via ~/.claude/skills
├── vendors/   # Third-party skill sources (e.g. vendors/gstack)
├── custom/    # First-party skill sources
└── README.md
```

## Rules

1. `active/` contains **only symlinks** — never raw skill folders.
2. Every skill in `vendors/` or `custom/` must have a symlink in `active/` to be visible to Claude.
3. Symlinks in `active/` point to `../vendors/<vendor>/<skill>` or `../custom/<skill>`.
4. New vendor skills: add source to `vendors/<vendor>/`, then symlink from `active/`.
5. New custom skills: add source to `custom/`, then symlink from `active/`.
6. Do not store tool-internal config, caches, or runtime state here.

## Maintenance

The skill library is pruned monthly to prevent token overhead and signal dilution.

- **Automated:** The nightly scheduler runs `/skill-prune` on the 7th of each month via `office-nightly-scheduler.sh`. It proposes deletions and consolidations; no changes are made without confirmation.
- **Manual:** Run `/skill-prune` in any Claude Code session to trigger an on-demand review.
- **Quality gate:** Every learned skill must pass all three: (1) not Googleable, (2) codebase/stack-specific, (3) describes a recurring problem. Fail on any one → deletion candidate.
- **Target size:** < 20 learned gotcha skills. Operational tools (`dokploy`, `gh`, `aws`, etc.) and workflow process skills are exempt from the count.
- **Pruning skill source:** `custom/learned/skill-prune/SKILL.md`
