# Memory Orchestrator — Complete Implementation

**Date:** 2026-05-07  
**Status:** Live  
**Commit:** a21fc7c8

---

## What This Is

A unified memory system with four integrated components:

1. **`/memory` orchestrator** — single natural-language entry point for ALL memory operations
2. **`mem-write.sh`** — creates/updates memory entries with auto-fact extraction
3. **`mem-facts.sh`** — manages structured entity-predicate-object facts
4. **`memory-recall-hook.sh`** — auto-detects user intent and injects memory context

**Key design:**
- Zero new infrastructure (pure shell + JSONL + markdown)
- Fully automatic (no commands to remember, hook-based)
- AI-agnostic & IDE-agnostic (works with Claude Code, Codex, Gemini, all IDEs)
- Facts populate automatically from memory entries
- All underlying tools remain independent and directly callable

---

## The Four Components

### 1. `/memory` Orchestrator Skill

**Location:** `brain/ai/skills/custom/memory/SKILL.md`

**What it does:** Accepts natural language and routes to the correct memory tool.

**Workflows:**
- **A: RECALL** — retrieve past decisions (`mem-search`)
- **B: CAPTURE** — save new information (`mem-write` + `mem-facts add`)
- **C: FACT** — add/query/invalidate facts (`mem-facts`)
- **D: REVIEW** — see all memory + facts (`mem-search full` + synthesize)
- **E: MAINTAIN** — update/correct/deprecate entries (`mem-write update`)

**Standing Memory Laws:**
- Every `mem-write` MUST produce facts (non-negotiable)
- Facts are atomic (one entity, one predicate, one object)
- Always dedup-check before writing
- Progressive disclosure on recall (search → ID fetch → full read)

**25+ natural language routes:** "what did we decide" → RECALL, "remember this" → CAPTURE, "what do we know about X" → FACTS, etc.

---

### 2. `mem-facts.sh` — Structured Facts Engine

**Location:** `brain/tools/scripts/mem-facts.sh`  
**Symlink:** `~/.local/bin/mem-facts`

**Commands:**
```bash
mem-facts add <entity> <predicate> <object> [--since DATE] [--source ID]
mem-facts list [entity]
mem-facts search <keyword>
mem-facts invalidate <fact-id>
```

**Data format (JSONL):**
```json
{"id":"fact-001","entity":"Steve","predicate":"role","object":"founder","valid_from":"2026-05-07","valid_to":null,"source":"mem-user-001"}
```

**Active facts** = where `valid_to` is null  
**Invalidation** = append new line with `valid_to` set (never delete original)

**No dependencies:** Pure grep+awk, no `jq`, no Python.

---

### 3. `mem-write.sh` — Memory Entry Writer

**Location:** `brain/tools/scripts/mem-write.sh`  
**Symlink:** `~/.local/bin/mem-write`

**Commands:**
```bash
mem-write user|feedback|project|ref <name> <description> [--body "..."] [--facts "e|p|o,e|p|o"]
mem-write update <id> [--name "..."] [--description "..."] [--body "..."]
```

**Create mode:**
1. Assigns next ID: `mem-{type}-NNN` (zero-padded 3 digits)
2. Slugifies name → filename
3. Writes frontmatter + body
4. Registers in MEMORY.md index
5. If `--facts` provided, calls `mem-facts add` for each triple

**Update mode:**
1. Finds file by ID
2. Patches specific fields (name/description/body)
3. Updates MEMORY.md index

---

### 4. `memory-recall-hook.sh` — Automatic Intent Detection

**Location:** `/Users/Office/.claude/hooks/memory-recall-hook.sh`  
**Type:** UserPromptSubmit hook

**4 Intent Patterns (detection order):**

1. **REVIEW** — "show all my memories", "audit memory", "what do I have saved"
   - Injects: full index + facts summary

2. **FACTS** — "what do we know about X", "show facts", "current status"
   - Extracts entity from prompt
   - Injects: facts for entity + related memory entries

3. **CAPTURE** — "remember this", "save this", "I prefer X", "note that"
   - Checks for duplicates
   - Injects: step-by-step capture instructions + existing related entries

4. **RECALL** — "what did we decide", "remind me", "do you remember" (existing behavior)
   - Injects: keyword search results + memory context

**How it works:**
- Runs on EVERY prompt (zero cost if no intent detected)
- Extracts keywords automatically
- Injects appropriate context block
- User sees injected context in prompt — no manual action needed

---

## Data Storage

### Memory Files

**Location:** `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/`

**Files:**
- `MEMORY.md` — index file (list of all entries with IDs and one-line summaries)
- `*.md` — individual memory entries (frontmatter + body)
- `facts.jsonl` — structured facts store (one JSON object per line)

**Memory file format:**
```markdown
---
id: mem-feedback-001
name: Claude Preferences
description: How Claude should behave in this workspace
type: feedback
created: 2026-05-07
---

## Content

Detailed preference information here...
```

### Facts Store

**Location:** `facts.jsonl` (append-only)

**Fields:**
- `id`: `fact-NNN` (unique, zero-padded 3 digits)
- `entity`: Subject (CamelCase for multi-word)
- `predicate`: Relationship type (role, prefers, uses, stack, deadline, timezone, etc.)
- `object`: Value (free text, <100 chars)
- `valid_from`: ISO date when fact became true (required)
- `valid_to`: ISO date when fact stopped being true, or null (active)
- `source`: Origin (memory ID like `mem-feedback-001` or literal `"session"`)

---

## Usage Workflows

### User says "Remember this: I prefer using Haiku as the default model"

**Flow:**
1. Hook detects CAPTURE intent
2. Injects capture instructions
3. AI calls: `mem-write feedback "Claude Preferences" "Default model preference" --body "..." --facts "Steve|prefers|Haiku as default model"`
4. Script creates `mem-feedback-NNN.md`
5. Script extracts fact: `mem-facts add Steve prefers "Haiku as default model" --source mem-feedback-NNN`
6. AI confirms: "Saved as mem-feedback-001. Also recorded 1 fact."

### User asks "What did we decide about database migrations?"

**Flow:**
1. Hook detects RECALL intent
2. Extracts keywords: `["database", "migrations", "decide"]`
3. Calls: `mem-search database migrations`
4. Injects matching entries as memory context
5. AI retrieves and cites memory entries in response

### User asks "What do we know about ProChat?"

**Flow:**
1. Hook detects FACTS intent
2. Extracts entity: `"ProChat"`
3. Calls: `mem-facts list ProChat` + `mem-search ProChat`
4. Injects facts + related memory entries
5. AI synthesizes fact context

### User says "Show all my memories"

**Flow:**
1. Hook detects REVIEW intent
2. Calls: `mem-search` (full index) + `mem-facts list`
3. Injects full index + facts summary
4. AI synthesizes memory overview with maintenance suggestions

---

## CLI Usage (Direct Tool Access)

### mem-search

```bash
mem-search                           # List all entries (index)
mem-search database                  # Keyword search
mem-search --id mem-feedback-001     # Fetch full entry by ID
mem-search --full migrations         # Full content of all matches
mem-search --facts Steve             # Search facts for "Steve"
```

### mem-write

```bash
mem-write user "Steve Westhoek" "Personal info" \
  --body "Founder of ProChat, works on AI infra" \
  --facts "Steve|role|founder,Steve|company|ProChat"

mem-write update mem-user-001 --body "Updated info here"
```

### mem-facts

```bash
mem-facts add Steve role founder --source mem-user-001
mem-facts list                       # All active facts
mem-facts list Steve                 # Facts for Steve only
mem-facts search founder             # Search by keyword
mem-facts invalidate fact-001        # Invalidate (appends valid_to)
```

---

## Automatic Behavior

### Hook Injection Points

**When:** Every user prompt (via UserPromptSubmit hook)

**What gets injected:**
- RECALL intent → `--- Memory recall ---` block with matching memory entries
- CAPTURE intent → capture instructions + dedup check results
- FACTS intent → facts for entity + related entries
- REVIEW intent → full index + facts summary
- (No injection if no intent detected)

**Where it appears:** Injected into the prompt JSON before the AI sees it. The AI sees the context and acts on it naturally.

### Fact Extraction (Automatic)

When `mem-write` is called with `--facts "e|p|o,e|p|o"`:
1. Calls `mem-facts add` as subprocess for each triple
2. Each fact gets timestamped (`valid_from` = today)
3. Facts are linked to source memory entry (`source` = mem ID)

**In Standing Memory Laws:** "Every `mem-write` must produce facts" — this is enforced by:
- The SKILL.md law (instruction layer)
- The hook's CAPTURE injection (step-by-step instructions)
- The `--facts` flag on `mem-write` (mechanical enforcement)

---

## AI-Agnostic Operation

**Works identically on:**
- Claude Code (`/memory` or natural language)
- Codex CLI (`/memory`)
- Gemini CLI (`/memory` via shell)
- Cursor, Kiro, Windsurf, Antigravity (via symlink `brain/ai/skills/active/memory`)

**Why AI-agnostic:**
- Pure markdown SKILL.md (no AI-specific syntax)
- Pure shell scripts (no AI SDK dependencies)
- Storage is plain text files (no cloud sync)
- Hook logic is environment-agnostic

**Sync to all targets:**
```bash
node tools/scripts/sync-ai-skills.mjs --check  # Verify
```

---

## Design Decisions

### Why JSONL for facts?

Append-only (no corruption risk), grep-searchable, no external dependencies. Invalidation = append new line with `valid_to` set, preserving history.

### Why no database?

Pure shell tools remain forever maintainable. Minimal dependencies. Easy to inspect, edit, backup. File-based means no server, no cloud, no authentication.

### Why facts are mandatory?

Facts populate automatically when you write memory. You never think about facts. The system extracts them. The hook injection tells the AI to do this. Standing Memory Laws enforce it.

### Why the hook fires on every prompt?

Intent detection is fast (regex, no LLM). Zero cost on non-intent prompts (passthrough). By the time the prompt reaches the AI, relevant context is already injected. The AI never has to think "should I search memory?"

### Why all tools are independent?

The orchestrator is a convenience layer, not a replacement. Power users can call `mem-search --id mem-user-001` directly. The CLI tools have full documentation. Nothing locks you into the orchestrator.

---

## Maintenance & Recovery

### Backup Strategy

Facts store:
```bash
cp ~/.claude/projects/.../memory/facts.jsonl ~/.claude/projects/.../memory/facts.jsonl.backup
```

Memory files:
```bash
tar -czf memory_backup_$(date +%Y%m%d).tar.gz ~/.claude/projects/.../memory/
```

### Debugging

**Check what the hook injects:**
```bash
echo '{"prompt":"remember this: I prefer Haiku"}' | bash ~/.claude/hooks/memory-recall-hook.sh | jq .prompt
```

**Validate facts.jsonl:**
```bash
cat ~/.claude/projects/.../memory/facts.jsonl | while read line; do echo "$line" | jq . >/dev/null || echo "Invalid: $line"; done
```

**List all active facts:**
```bash
mem-facts list
```

**Search memory:**
```bash
mem-search architecture
```

---

## Next Steps for Users

1. **Try the system:** Talk naturally about memory (save something, ask about past decisions)
2. **Watch facts accumulate:** `mem-facts list` shows what's been learned
3. **Use REVIEW:** Ask "show all my memories" to see the index
4. **Add structure:** Use Standing Memory Laws as your mental model
5. **Maintain:** Periodically run `mem-write update <id>` to correct or deprecate entries

---

## Files Changed

| File | Change |
|------|--------|
| `brain/tools/scripts/mem-facts.sh` | Created |
| `brain/tools/scripts/mem-write.sh` | Created |
| `brain/tools/scripts/mem-search.sh` | Updated (add `--facts`) |
| `/Users/Office/.claude/hooks/memory-recall-hook.sh` | Replaced (4 intents) |
| `brain/ai/skills/custom/memory/SKILL.md` | Created |
| `brain/ai/skills/active/memory` | Symlink created |
| `~/.claude/projects/.../memory/facts.jsonl` | Created (empty) |
| `/Users/Office/.claude/CLAUDE.md` | Updated (add `/memory`) |
| `brain/CLAUDE.md` | Updated (Memory System section) |
| `brain/operations/system-configs/codex/AGENTS.md` | Updated |
| `brain/operations/system-configs/gemini/GEMINI.md` | Updated |
| `~/.local/bin/mem-facts` | Symlink created |
| `~/.local/bin/mem-write` | Symlink created |

---

## Testing

Quick verification:

```bash
# 1. Tools are available
which mem-search mem-write mem-facts

# 2. Facts store works
mem-facts add Test entity value
mem-facts list
mem-facts invalidate fact-001
mem-facts list  # fact-001 gone from active

# 3. Memory entry creation
mem-write user "Test" "Test entry" --facts "Test|entity|value"
mem-search Test
mem-search --id mem-user-001

# 4. Hook detects intents
echo '{"prompt":"remember this: test"}' | bash ~/.claude/hooks/memory-recall-hook.sh | jq .prompt | grep -i capture

# 5. Skill is synced
ls -la brain/ai/skills/active/memory
```

---

## Reference

- **Skill:** `brain/ai/skills/custom/memory/SKILL.md`
- **Hooks:** `~/.claude/hooks/memory-recall-hook.sh`
- **Tools:** `~/.local/bin/mem-{search,write,facts}`
- **Storage:** `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/`
- **Configs:** CLAUDE.md, AGENTS.md, GEMINI.md updated
- **Commit:** a21fc7c8
