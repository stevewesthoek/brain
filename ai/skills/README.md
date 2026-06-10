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
2. `active/` is the default exported surface that Claude, Codex, Gemini, Cursor, Kiro, and Antigravity read directly.
3. Skills in `vendors/` or `custom/` may remain dormant when they are too specialized or are meant to be routed by a higher-level orchestrator.
4. Symlinks in `active/` point to `../vendors/<vendor>/<skill>` or `../custom/<skill>`.
5. New vendor/custom skills should be registered in `docs/skills/skill-index.md`; add a symlink in `active/` only when the skill is intentionally default-active.
6. Orchestrators such as `code` may use dormant source skills automatically from the registry and source docs. Example: `custom/greploop` remains dormant but is part of `/code`'s automatic review-fix-review workflow.
7. Do not store tool-internal config, caches, or runtime state here.
8. Before adding permanent rules to a skill, classify them with `docs/rules/rule-onboarding-and-hook-policy.md`. Deterministic command/path/diff rules should move to hooks or CI when feasible; skills should keep task-specific workflow knowledge and judgment rules.

## Design Skill Routing

For the full design workflow and skill coordination, see `../design-systems/design-stack.md`.

**Quick reference:**

- `design-system` — persistent `DESIGN.md` / `brand-spec.md`
- `web-design` — implementation-ready web/SaaS UI specs
- `ui-ux-pro-max` — searchable UI/UX intelligence and research support
- `taste-skill` — premium taste and anti-slop guardrails
- `redesign-skill` — safe existing-project redesign
- `huashu-design` — HTML-native visual production artifacts (prototypes, decks, animations, exports)
- `impeccable` — tactical frontend polish, anti-slop audits, hardening, and live visual iteration; reads `DESIGN.md` / `brand-spec.md`; does not replace `design-system`

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

## Sync / Export to AI Tools

**Invariant: `active/` is the only canonical skill export surface for all AI/IDE consumers.**

After installing or activating any skill in `active/`, you **must** run the sync script to make it available to all consumers:

```bash
# Preview what will change
node tools/scripts/sync-ai-skills.mjs --dry-run --verbose

# Apply the sync
node tools/scripts/sync-ai-skills.mjs

# Verify sync is complete and ALL active skills are reachable at top-level paths
node tools/scripts/sync-ai-skills.mjs --check
```

A passing `--check` means:
- Every active skill is visible at `<consumer-target>/<skill>/SKILL.md` for all consumers
- Claude Code, Codex, Gemini, Cursor, Kiro, and Antigravity all see the same active skill set

**Never manually copy skills into tool-specific folders.** The sync script is the sole source of truth for exporting skills. Vendor and custom source folders must remain hidden unless explicitly activated through `active/`.
