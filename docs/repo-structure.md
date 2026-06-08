# Brain Repository Structure

This document describes the intended structure and purpose of the Brain repository root and key folders.

## Root-Level Files

### AI/Tooling Entry Points (Read First)
- **`AGENTS.md`** — AI agent entry point. Canonical first document for any AI system interaction.
- **`CLAUDE.md`** — Detailed Claude Code and repo-specific operating rules.

### Context & Navigation (AI Session Support)
- **`00-start-here.md`** — High-level repo map and operating model. Read after AGENTS.md.
- **`00-current-context.md`** — Current AI-system priorities and active context.
- **`00-memory-map.md`** — Index and retrieval map for shared memory system.

### Human Readability
- **`README.md`** — Full repo structure, contribution contract, folder descriptions, and quick reference.

### Session Management (AI Handoff System)
- **`.ai/`** — Operational context folder for AI session recovery (tracked, intentional)
  - `.ai/current.md` — Short-term session handoff (auto-written by hooks, ignored by git but recoverable)
  - `.ai/decision-log.md` — Durable decision history (append-only, tracked)
  - `.ai/handoffs/` — Optional milestone snapshots (tracked for important checkpoints)
  - Do not move or rename without updating `/handoff` skill and all hooks

### Not Committed to Root
- Runtime-generated files (`.gitignore` excludes these)
- Session state and debug dumps (except `.ai/` which is intentional)
- Generated tool artifacts
- Local machine state

## Folder Structure

| Folder | Purpose | Notes |
|--------|---------|-------|
| `.ai/` | **Session recovery state** (intentional, operational) | Contains `.ai/current.md` (session handoff), `.ai/decision-log.md` (durable decisions), `.ai/handoffs/` (milestone snapshots). Tracked in git for continuity. Do not move without updating handoff skill. See "Session Management" section above. |
| `ai/` | **Shared AI skills, policies, agents, and prompts** | Tracked, durable infrastructure. See `ai/skills/` for active skill symlinks (should contain only symlinks, never raw skill folders). |
| `docs/` | Documentation: architecture, guides, skill profiles, and archived reports | See `docs/repo-structure.md` (this file) |
| `operations/` | Runbooks, standards, system configs, deploy docs, infrastructure, decision log | Critical: `operations/system-configs/` contains symlink targets for `~/.claude`, `~/.codex`, etc. |
| `tools/` | Utility scripts, workflow wrappers, and tool-specific documentation | See `tools/scripts/` for automated helpers |
| `projects/` | Project-specific context, specifications, and execution documentation | Organized by project; each active project should have its own README |
| `runtime/` | Runtime workspace notes, local support folders, and bootstrap helpers | Not canonical truth by default; use for temporary state and runtime pointers |

## Key Constraints

### Do Not Move, Rename, or Delete
- `.ai/` — Session recovery system used by `/handoff` skill and hooks. Moving requires updating:
  - `/handoff` skill implementation
  - `operations/system-configs/claude/hooks/inject-handoff.sh`
  - `tools/scripts/auto-handoff.sh`
  - `CLAUDE.md` session lifecycle documentation
  - All AI agent AGENTS.md files (claude, codex, gemini)
  - Breaks session resume workflows if paths change.
- `operations/system-configs/` — Contains 17 symlinks to home directory config. Moving breaks all tool integrations.
- `ai/skills/active/` — Should contain only symlinks to `vendors/` or `custom/` skill sources, never raw skill folders.
- `tools/scripts/` — Contains CLI automation and helper scripts.
- `.github/` — Contains CI/CD and GitHub Actions configurations.

### Preserved for Continuity
- `package.json` / `package-lock.json` — Node.js project metadata
- `docker-compose.yml` — Local database and container runtime configuration
- `.gitignore` — Version control rules

## Archived Reports

Historical reports and analysis documents are archived in:
```
docs/archive/reports/
```

Examples:
- `GEMMA4_UPGRADE_SUMMARY.md`
- `HARDENING-PHASE-FINAL-REPORT.md`
- `INFRASTRUCTURE-SUMMARY.md`
- `PRODUCER-HARDENING-FINAL-ANSWERS.md`
- `SKILL-BLOAT-ANALYSIS.md`
- `SKILL-PROFILE-APPLIED.md`

These are retained for historical context but do not clutter the root directory.

## Reading Order

### For AI Agents
1. `AGENTS.md`
2. `00-start-here.md`
3. `00-current-context.md`
4. `00-memory-map.md`
5. `README.md` (when full structure is needed)
6. `CLAUDE.md` (when detailed behavior rules are needed)

### For Humans
1. `README.md`
2. `projects/README.md`
3. `ai/README.md`
4. `operations/README.md`
5. `runtime/README.md`

### For Reference
- Skill documentation: `docs/skills/`
- Runbooks and procedures: `operations/runbooks/`
- System standards: `operations/standards/`
- Confirmed decisions: `operations/decision-log.md`
- CLI registry: `operations/CLI-MANIFEST.md`

## Design Principles

The Brain repository is optimized for:
- **Clear top-level boundaries** — Distinct folder purposes, minimal overlap
- **Low ambiguity** — Canonical truth in one place, well-documented locations
- **Minimal duplication** — Shared skills and config live once, not replicated
- **Separation of concerns** — Runtime state separated from durable knowledge
- **Readability** — Both human and AI agents can navigate quickly

## Cross-Repo Context

Brain is paired with `mind` for operational completeness:

```
brain = AI operating system: skills, tools, configs, runbooks, automation
mind  = Steve's personal memory: strategy, convictions, tasks, research, projects
```

When the AI system needs to make decisions based on personal strategy, business context, or theology, it consults `mind`. When the system needs to understand its own infrastructure and how to operate, it consults `brain`.

Do not store personal strategy or theology in Brain unless it is specifically AI-system configuration. Do not store AI infrastructure or skill documentation in Mind.

## Modification Contract

Before modifying root-level files or structure:

1. Check if the change affects any symlink targets (see CLAUDE.md, "Do not break" section)
2. If moving or deleting a folder, verify it is not referenced in this document
3. If adding a new top-level folder, update this document and the README.md structure table
4. Use small, focused commits rather than massive root restructures
5. Ask for approval before high-risk structural changes

For more details, see `README.md` under "Expanding This Repo" and `CLAUDE.md` under "Do not break".
