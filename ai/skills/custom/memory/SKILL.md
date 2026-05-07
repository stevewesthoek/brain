---
name: memory
description: Memory orchestrator. Single entry point for all memory operations — capturing preferences and facts, recalling past decisions, querying structured facts, reviewing saved entries, and maintaining/correcting memory. Accepts natural language. No commands to remember. AI-agnostic, IDE-agnostic. Works with Claude Code, Codex, and Gemini CLI.
---

# Memory — Master Orchestrator

You are the single entry point for all memory operations. When the user says anything related to remembering, saving, recalling, reviewing, or correcting memory — this orchestrator runs.

The user does not need to know that `mem-write`, `mem-facts`, or `mem-search` exist, or which commands each supports. Your job is to call the right tool with the right arguments and report back clearly.

**Natural language triggers (non-exhaustive):**
- "what did we decide about X" / "remind me about Y" / "do you remember Z"
- "remember this / save this / I prefer X" / "note that Y"
- "what do we know about X" / "show facts for X" / "current status of Y"
- "show all my memories" / "what do I have saved" / "memory overview"
- "update that memory" / "that's outdated" / "delete this entry"

---

## Standing Memory Laws (Always Active)

Apply these silently — never explain them to the user.

### Write Laws
- **Every `mem-write` must produce facts.** After creating or updating a memory entry, extract discrete, queryable facts and write them via `mem-facts add`. Never write a memory without facts. This is non-negotiable.
- **Facts are atomic.** One entity, one predicate, one object per fact. Never compound multiple facts into one line.
- **Prevent duplicates before writing.** Always run `mem-search <keyword>` first to check if an existing entry covers this. Offer to update instead of creating a new entry.
- **Memory type selection rule:**
  - `user` — personal info, preferences, role, identity
  - `feedback` — how AI should behave, what to avoid, work style
  - `project` — project decisions, status, milestones, timelines
  - `ref` — external URLs, APIs, tools, credentials, references

### Fact Laws
- **Prefer specific predicates:** `role`, `prefers`, `avoids`, `uses`, `owns`, `deadline`, `timezone`, `location`, `contact`, `stack` over vague ones like `info` or `data`.
- **When invalidating a fact, ask if a replacement fact should be added immediately.** Never leave a fact invalidated without context.

### Recall Laws
- **Progressive disclosure:** Always `mem-search <keyword>` first (index + file matches). Only call `mem-search --id <id>` for entries clearly relevant. Never read all memory at once.
- **Cite IDs in responses:** "Per mem-feedback-003, we prefer X because Y."
- **Cap at 3 full-content fetches** per recall operation.

### Review Laws
- **A review starts with full index**, never with individual file reads.
- **Suggest maintenance but never execute without confirmation.** E.g., "I noticed mem-project-001 and mem-project-002 might overlap — want me to deduplicate?"

---

## Step 0: Classify

No intake question needed. Classify directly from the user's message.

**Detect intent:**
- `RECALL` — user wants to retrieve past information
- `CAPTURE` — user wants to save new information
- `FACT` — user wants to add, query, or invalidate a structured fact
- `REVIEW` — user wants to see all/many memory entries
- `MAINTAIN` — user wants to update, correct, or delete

---

## Workflow A: RECALL

**Trigger:** "what did we decide about X", "remind me of Y", "do you remember Z", "what's our approach"

### A1. Extract keywords
Take 1–3 meaningful words from the query (strip stop words and recall trigger phrases).

### A2. Search index
```bash
mem-search <keywords>
```
Output format: index matches + file matches with IDs.

### A3. Progressive disclosure
For each file match that looks relevant:
```bash
mem-search --id mem-{type}-NNN
```
Limit to 3 fetches. Stop when you have enough context.

### A4. Respond
Answer the user's question citing the memory IDs:
> "Per mem-feedback-002, we prefer X because Y."

If nothing found: say so directly. Do not invent.

---

## Workflow B: CAPTURE

**Trigger:** "remember this", "save this", "I prefer X", "note that", "make a note"

### B1. Check for duplicates
```bash
mem-search <keywords from content>
```
If an existing entry covers this: offer to update it with `mem-write update <id>` instead of creating a new one.

### B2. Determine type
| Content describes | Type |
|------|------|
| Personal preference, role, info about user | `user` |
| How AI should behave, what to avoid | `feedback` |
| Project decision, status, milestone | `project` |
| External URL, API, tool, credential hint | `ref` |

### B3. Write the memory
```bash
mem-write {type} "{name}" "{description}" --body "{content}"
```

### B4. Extract and write facts (MANDATORY)
For each discrete fact in the content, call:
```bash
mem-facts add "{entity}" "{predicate}" "{object}" --source {new-id}
```

Examples of fact extraction:
- Content: "I prefer using Haiku as the default model" → `mem-facts add Steve prefers "Haiku as default model" --source mem-feedback-005`
- Content: "ProChat uses Supabase + Dokploy" → `mem-facts add ProChat uses "Supabase + Dokploy" --source mem-project-003`
- Content: "Completed Q2 roadmap on 2026-05-05" → `mem-facts add Q2 status completed --source mem-project-004` AND `mem-facts add Q2 completed_date 2026-05-05 --source mem-project-004`

A capture event with zero extractable facts is rare. When in doubt, extract.

### B5. Confirm
"Saved as mem-{type}-NNN. Also recorded N fact(s)."

---

## Workflow C: FACT (direct fact operations)

**Trigger:** "add a fact", "what do we know about X", "show facts for X", "invalidate fact-NNN"

### C-add
```bash
mem-facts add "{entity}" "{predicate}" "{object}" [--since YYYY-MM-DD] [--source ID]
```

### C-list
```bash
mem-facts list [entity]
```
Shows all active facts, optionally filtered by entity.

### C-search
```bash
mem-facts search "{keyword}"
# Or equivalently:
mem-search --facts "{keyword}"
```

### C-invalidate
```bash
mem-facts invalidate fact-NNN
```
Then ask: "Should I add a replacement fact for this?"

---

## Workflow D: REVIEW

**Trigger:** "show all my memories", "audit memory", "what do I have saved", "memory overview"

### D1. Load full index
```bash
mem-search
```

### D2. Load facts summary
```bash
mem-facts list
```

### D3. Synthesize
Present:
- Total count by type (user/feedback/project/ref)
- Most recent 3–5 entries
- Total active fact count
- Any obvious maintenance suggestions (duplicates, stale entries)

### D4. Maintenance offer
"I noticed [X]. Want me to update/deduplicate/correct any of these?"

---

## Workflow E: MAINTAIN

**Trigger:** "update mem-NNN", "correct that memory", "that's outdated", "remove that"

### E-update
```bash
mem-write update {id} [--name "..."] [--description "..."] [--body "..."]
```

### E-correct-facts
If underlying facts are now stale:
```bash
mem-facts invalidate fact-NNN
mem-facts add "{entity}" "{predicate}" "{new-object}" --source {id}
```

### E-deprecate
`mem-write` does not support delete. To deprecate an entry: update its description to include "(deprecated)" and note why. Mark as stale, never fully remove. The history matters.

---

## Tool Reference Map

| Tool | Command | When |
|------|---------|------|
| `mem-search` | `mem-search` | List full index |
| `mem-search` | `mem-search <keyword>` | Keyword search (index + files) |
| `mem-search` | `mem-search --id <id>` | Fetch full entry by ID |
| `mem-search` | `mem-search --full <keyword>` | Full content of all matches |
| `mem-search` | `mem-search --facts <keyword>` | Search structured facts |
| `mem-write` | `mem-write user\|feedback\|project\|ref <name> <desc>` | Create new entry |
| `mem-write` | `mem-write update <id> [--name/--description/--body ...]` | Update existing entry |
| `mem-facts` | `mem-facts add <entity> <predicate> <object>` | Add a fact |
| `mem-facts` | `mem-facts list [entity]` | List active facts (filtered or all) |
| `mem-facts` | `mem-facts search <keyword>` | Search facts |
| `mem-facts` | `mem-facts invalidate <fact-id>` | Invalidate a fact (append valid_to) |

---

## Natural Language → Routing Guide

| User says | Intent | Workflow | Tool(s) |
|-----------|--------|----------|---------|
| "what did we decide about X" | RECALL | A | `mem-search X` |
| "remind me about Y" | RECALL | A | `mem-search Y` |
| "do you remember our approach to Z" | RECALL | A | `mem-search Z` |
| "what's our preference on X" | RECALL | A | `mem-search X` |
| "how did we handle X last time" | RECALL | A | `mem-search X` |
| "what config do we use for X" | RECALL | A | `mem-search config X` |
| "why did we choose X over Y" | RECALL | A | `mem-search X Y` |
| "remember this: I prefer X" | CAPTURE | B | `mem-write user` |
| "save this as a note" | CAPTURE | B | `mem-write feedback\|project` |
| "make a note that we're using X" | CAPTURE | B | `mem-write project` |
| "note that I dislike X" | CAPTURE | B | `mem-write feedback` |
| "save this URL for later" | CAPTURE | B | `mem-write ref` |
| "I want you to always do X" | CAPTURE | B | `mem-write feedback` |
| "remember that Steve works on X" | CAPTURE | B | `mem-write user` + facts |
| "what do we know about X" | FACT/RECALL | C→A | `mem-facts search X` then `mem-search X` |
| "show facts for X" | FACT | C | `mem-facts list X` |
| "current status of X" | FACT | C | `mem-facts search X` |
| "add a fact: X is Y" | FACT | C | `mem-facts add X ... Y` |
| "invalidate fact-NNN / that's no longer true" | FACT | C | `mem-facts invalidate fact-NNN` |
| "show all my memories" | REVIEW | D | `mem-search` + `mem-facts list` |
| "audit memory / memory overview" | REVIEW | D | `mem-search` + `mem-facts list` + synthesize |
| "what do I have saved" | REVIEW | D | `mem-search` + synthesize |
| "update mem-NNN" | MAINTAIN | E | `mem-write update` |
| "that memory is outdated" | MAINTAIN | E | `mem-write update` + `mem-facts invalidate` |
| "merge mem-NNN and mem-NNN" | MAINTAIN | E | `mem-write update` + deprecate old |
| "delete this memory" | MAINTAIN | E | `mem-write update` (add "(deprecated)") |

---

## AI-Agnostic & IDE-Agnostic Operation

This orchestrator is pure markdown. All tools are plain shell scripts in PATH.

Works identically on:
- **Claude Code** — `/memory` or describe in natural language (hook auto-triggers)
- **Codex CLI** — `/memory`
- **Gemini CLI** — `/memory` via `run_shell_command`
- **Any IDE** — via `brain/ai/skills/active/memory` symlink

**Tool wrappers (CLI-based):**
- `mem-search` — `~/.local/bin/mem-search` → `brain/tools/scripts/mem-search.sh`
- `mem-write` — `~/.local/bin/mem-write` → `brain/tools/scripts/mem-write.sh`
- `mem-facts` — `~/.local/bin/mem-facts` → `brain/tools/scripts/mem-facts.sh`

**Source of truth:**
- This SKILL.md file
- The three shell scripts (all standard bash, no MCP servers, no external APIs)
- Storage: `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/` (markdown files + facts.jsonl)

**Zero vendor lock-in:** All tools are plain bash. No MCP servers, no IDE-specific plugins, no cloud dependencies.

---

## Underlying Tools Remain Independent

**Important:** The `/memory` orchestrator is a **routing layer only**. It does NOT replace or constrain the underlying tools.

- Users can still invoke `mem-search`, `mem-write`, `mem-facts` directly via CLI
- Users can still run shell commands directly: `mem-facts list`, `mem-search --id mem-user-001`, etc.
- Each tool has its own documentation and remains fully independent
- The orchestrator is a convenience layer for users who prefer natural language routing

**Decision tree for users:**
- "I don't know which memory tool to use" → Use `/memory` orchestrator (natural language routing)
- "I know exactly which command I want" → Call it directly (skip the orchestrator)
- Both paths are equally valid and coexist.
