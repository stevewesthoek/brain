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

## Design Skill Routing

For the full design workflow and skill coordination, see `../design-systems/design-stack.md`.

**Quick reference:**

- `design-system` — persistent `DESIGN.md` / `brand-spec.md`
- `web-design` — implementation-ready web/SaaS UI specs
- `ui-ux-pro-max` — searchable UI/UX intelligence and research support
- `taste-skill` — premium taste and anti-slop guardrails
- `redesign-skill` — safe existing-project redesign
- `huashu-design` — HTML-native visual production artifacts (prototypes, decks, animations, exports)

All design skills read `DESIGN.md` and `brand-spec.md` for consistency.

## Maintenance

The skill library is pruned monthly to prevent token overhead and signal dilution.

**Automated (Monthly on 7th):**
- Scheduler runs `tools/scripts/skill-prune-report.sh` (REPORT-only, no file modifications)
- Generates candidate report: `runtime/local/skill-prune/latest.md` and `.json`
- Optional email delivery to configured address via GWS Gmail API
- Never quarantines or deletes automatically — REPORT mode only

**Manual Actions (Optional):**
- Quarantine: `bash tools/scripts/skill-prune-quarantine.sh <skill-name>` (symlink-only, source preserved, requires confirmation)
- Delete: `bash tools/scripts/skill-prune-delete.sh <skill-name>` (requires prior quarantine + 30-day age threshold)
- Keep: `bash tools/scripts/skill-prune-keep.sh <skill-name> [reason]` (audit log only, non-destructive)

**Quality Gate:** Every learned skill must pass all three: (1) not Googleable, (2) codebase/stack-specific, (3) describes a recurring problem. Fail on any one → deletion candidate.

**Target Size:** < 20 learned gotcha skills. Operational tools (`dokploy`, `gh`, `aws`, etc.) and workflow process skills are exempt from the count.

**Workflow Guide:** See `custom/learned/skill-prune/SKILL.md` for complete documentation.
