# Kiro Global Steering Setup — Brain + Mind Context

**Status:** Manual setup required  
**Reason:** Current BuildFlow write policy blocks creating `operations/system-configs/kiro/**`, so this runbook records the exact steering file content and setup command.

---

## Purpose

Kiro should share the same context model as Claude Code, Codex, Gemini, Cursor, and Antigravity:

```text
brain = AI operating system
mind  = Steve's personal memory
current workspace = implementation target
```

Kiro supports global steering files under:

```text
~/.kiro/steering/
```

Global steering applies to all workspaces, so this is the correct place for a lightweight pointer. Do not put large duplicated context here.

---

## Recommended File

Create:

```text
~/.kiro/steering/brain-mind-context.md
```

With this content:

```markdown
# Brain + Mind Context

This is a lightweight global steering pointer for Kiro.

Do not duplicate the full context rules here. The canonical IDE context contract is:

/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/ide-context.md

## Required Context Model

brain = AI operating system
mind = Steve's personal memory
current workspace = implementation target

## Brain Context

Use brain for AI-system questions:

/Users/Office/Repos/stevewesthoek/brain/AGENTS.md
/Users/Office/Repos/stevewesthoek/brain/00-start-here.md
/Users/Office/Repos/stevewesthoek/brain/00-current-context.md
/Users/Office/Repos/stevewesthoek/brain/00-memory-map.md

## Mind Context

Use mind for personal, business, ministry, theology, project, task, resource, and research questions:

/Users/Office/Repos/stevewesthoek/mind/AGENTS.md
/Users/Office/Repos/stevewesthoek/mind/00-start-here.md
/Users/Office/Repos/stevewesthoek/mind/00-current-context.md
/Users/Office/Repos/stevewesthoek/mind/00-memory-map.md

## Behavior Rule

Do not load both repos fully. Read entrypoints when relevant, then search/read only the relevant folders.

Do not edit brain or mind unless the user asks or the task clearly requires it. The current Kiro workspace remains the implementation target.

## Why This Exists

This avoids repeated explanations and keeps Kiro aligned with Claude Code, Codex, Gemini, Cursor, and Antigravity while preventing context flooding.
```

---

## Setup Command

Run locally:

```bash
mkdir -p ~/.kiro/steering
cat > ~/.kiro/steering/brain-mind-context.md <<'EOF'
# Brain + Mind Context

This is a lightweight global steering pointer for Kiro.

Do not duplicate the full context rules here. The canonical IDE context contract is:

/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/ide-context.md

## Required Context Model

brain = AI operating system
mind = Steve's personal memory
current workspace = implementation target

## Brain Context

Use brain for AI-system questions:

/Users/Office/Repos/stevewesthoek/brain/AGENTS.md
/Users/Office/Repos/stevewesthoek/brain/00-start-here.md
/Users/Office/Repos/stevewesthoek/brain/00-current-context.md
/Users/Office/Repos/stevewesthoek/brain/00-memory-map.md

## Mind Context

Use mind for personal, business, ministry, theology, project, task, resource, and research questions:

/Users/Office/Repos/stevewesthoek/mind/AGENTS.md
/Users/Office/Repos/stevewesthoek/mind/00-start-here.md
/Users/Office/Repos/stevewesthoek/mind/00-current-context.md
/Users/Office/Repos/stevewesthoek/mind/00-memory-map.md

## Behavior Rule

Do not load both repos fully. Read entrypoints when relevant, then search/read only the relevant folders.

Do not edit brain or mind unless the user asks or the task clearly requires it. The current Kiro workspace remains the implementation target.

## Why This Exists

This avoids repeated explanations and keeps Kiro aligned with Claude Code, Codex, Gemini, Cursor, and Antigravity while preventing context flooding.
EOF
```

---

## Verification Prompt

Start a new Kiro session and ask:

```text
Before answering, use your global steering. Which repo is for AI-system context and which repo is for personal research?
```

Expected answer:

```text
brain = AI-system context
mind = personal research and personal memory
```

---

## Maintenance Rule

If the canonical context model changes, update these files together:

```text
brain/operations/runbooks/ai-context-propagation.md
brain/operations/system-configs/ide-context.md
~/.kiro/steering/brain-mind-context.md
```

Keep the Kiro steering file short. It should point to canonical docs, not duplicate the full architecture.
