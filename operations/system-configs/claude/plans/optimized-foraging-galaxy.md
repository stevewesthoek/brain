# Plan: Memory Orchestrator + Structural Facts

## Context

The current memory system has solid read/inject infrastructure (mem-search, two UserPromptSubmit hooks) but lacks:
- A write path (no way to create memory entries from the CLI)
- Structural facts (no queryable entity-predicate-object store)
- A single orchestrator skill that unifies all memory operations
- Natural language CAPTURE/FACTS/REVIEW intent detection in the hook

The user wants: talk naturally, memory works. Black box. No commands. AI-agnostic, IDE-agnostic, single entry point for everything memory-related.

**No MemPalace. No ChromaDB. No Python. Pure shell + JSONL + Markdown.**

---

## What Gets Built

| File | Action | Purpose |
|------|--------|---------|
| `brain/tools/scripts/mem-facts.sh` | Create | JSONL-based structured facts engine |
| `brain/tools/scripts/mem-write.sh` | Create | Write new/update memory entries + auto-dispatch facts |
| `brain/tools/scripts/mem-search.sh` | Update | Add `--facts <keyword>` flag |
| `~/.claude/hooks/memory-recall-hook.sh` | Replace | Expand from 1 intent to 4 (RECALL/CAPTURE/FACTS/REVIEW) |
| `brain/ai/skills/custom/memory/SKILL.md` | Create | Master orchestrator skill |
| `brain/ai/skills/active/memory` | Create symlink | `-> ../custom/memory` |
| `~/.claude/projects/.../memory/facts.jsonl` | Create (empty) | Structural facts store |
| `~/.local/bin/mem-write` | Create symlink | -> mem-write.sh |
| `~/.local/bin/mem-facts` | Create symlink | -> mem-facts.sh |
| `/Users/Office/.claude/CLAUDE.md` | Update | Add `/memory` to skills list |
| `brain/CLAUDE.md` | Update | Memory section update (write path + orchestrator) |
| `brain/operations/system-configs/codex/AGENTS.md` | Update | Memory promotion table + new tools |
| `brain/operations/system-configs/gemini/GEMINI.md` | Update | Memory promotion table + new tools |

---

## 1. facts.jsonl — Data Format

Location: `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/facts.jsonl`
One JSON object per line. Append-only. No array wrapping.

```jsonl
{"id":"fact-001","entity":"Steve","predicate":"role","object":"founder","valid_from":"2026-05-07","valid_to":null,"source":"session"}
{"id":"fact-002","entity":"Steve","predicate":"prefers","object":"Haiku as default model","valid_from":"2026-05-07","valid_to":null,"source":"session"}
```

- `id`: `fact-NNN` zero-padded 3 digits
- `entity`: subject, CamelCase for multi-word
- `predicate`: relationship type (`role`, `prefers`, `uses`, `stack`, `deadline`, `avoids`, `owns`, `timezone`, `contact`, `location`)
- `object`: free text, <100 chars
- `valid_from`: required ISO `YYYY-MM-DD`
- `valid_to`: `null` until invalidated, then ISO date
- `source`: `"session"` or `"mem-{type}-NNN"`

Invalidation = append new line with `valid_to` set (original line preserved). Active facts = lines where `valid_to` is null.

---

## 2. mem-facts.sh

Location: `brain/tools/scripts/mem-facts.sh` → symlink `~/.local/bin/mem-facts`

```
Commands:
  mem-facts add <entity> <predicate> <object> [--since YYYY-MM-DD] [--source ID]
  mem-facts list [entity]
  mem-facts search <keyword>
  mem-facts invalidate <fact-id>
```

Key implementation details:
- All JSON parsing via `grep -oE '"field":"([^"]*)"' | cut -d'"' -f4` — NO jq dependency
- ID assignment: `$(wc -l < "$FACTS_FILE" | tr -d ' ')` + 1, zero-padded to 3 digits
- `list` and `search` filter on `"valid_to":null` to show only active facts
- `invalidate` appends modified copy with `valid_to` = today; never deletes original
- Output format: `[fact-NNN] entity | predicate | object (since VALID_FROM, src: SOURCE)`

---

## 3. mem-write.sh

Location: `brain/tools/scripts/mem-write.sh` → symlink `~/.local/bin/mem-write`

```
Commands:
  mem-write user|feedback|project|ref <name> <description> [--body "..."] [--facts "e|p|o,e|p|o"]
  mem-write update <id> [--name "..."] [--description "..."] [--body "..."]
```

Key implementation details:
- ID assignment: scan MEMORY.md for `\[mem-{type}-` lines, find highest NNN, increment
- Filename: `{type}_{slugified_name}_{NNN}.md` (slug = lowercase, spaces→underscores, strip non-alnum)
- Writes file with frontmatter: `id`, `name`, `description`, `type`, `created`
- Appends to MEMORY.md index: `- [mem-{type}-NNN] [name](filename.md) — description`
- `--facts "e1|p1|o1,e2|p2|o2"` → calls `mem-facts add` as subprocess for each triple
- `update` mode: finds file by ID (grep frontmatter), patches specific fields
- Confirms: `Created mem-{type}-NNN: {filename}` or `Updated {id}`

---

## 4. mem-search.sh — Changes Only

Add to top: `FACTS_FILE="${MEMORY_DIR}/facts.jsonl"`

Add new case branch before `*`:
```bash
--facts)
  keyword="${2:?Usage: mem-search --facts <keyword>}"
  [ ! -f "$FACTS_FILE" ] && echo "(facts store empty)" && exit 0
  grep -i "$keyword" "$FACTS_FILE" | grep '"valid_to":null' | while IFS= read -r line; do
    id=$(...)  entity=$(...)  predicate=$(...)  object=$(...)  since=$(...)
    echo "  [$id] $entity | $predicate | $object (since $since)"
  done
  ;;
```

---

## 5. memory-recall-hook.sh — 4-Intent Expansion

Complete replacement of existing file (same hook slot in settings.json, same filename).

**Detection order (first match wins):**
1. REVIEW — `"show all my memories|audit memory|what do I have saved|list all memories|show me everything saved|memory overview|full memory|show memory index|what have I saved"`
2. FACTS — `"what do we know about|show facts|current status of|facts about|what facts|tell me about|what is the current|profile of|what do you know about"`
3. CAPTURE — `"remember this|save this|note that|make a note|I prefer|I want you to know|keep in mind|store this|save that|add to memory|worth remembering|don't forget that|write this down|log this"`
4. RECALL — existing pattern (unchanged)

**Injection payloads:**

RECALL (unchanged):
```
--- Memory recall ---
[mem-search output, max 5 entries]
---
```

CAPTURE:
```
--- Memory capture instructions ---
The user wants to save something to memory. Steps:
1. Type: user (personal info/prefs), feedback (how AI should behave), project (decisions/status), ref (URLs/tools)
2. Dedup check: mem-search <keywords>
3. Write: mem-write {type} "<name>" "<description>" --body "<content>"
4. Extract facts (MANDATORY): mem-facts add "<entity>" "<predicate>" "<object>" --source <new-id>
5. Confirm: "Saved as mem-{type}-NNN. Also recorded N fact(s)."
Existing related entries:
[mem-search output for extracted keywords, max 3]
---
```

FACTS (entity extracted from prompt):
```
--- Facts context ---
Known facts about [ENTITY]:
[mem-facts list ENTITY output]
Related memory entries:
[mem-search ENTITY output, max 3]
---
```

REVIEW:
```
--- Memory index ---
[full mem-search output (no keyword)]
Facts summary:
[mem-facts list output]
---
```

**Entity extraction for FACTS:** strip trigger phrase words from prompt, apply stop-word filter, take first 2 remaining words joined with space.

---

## 6. memory/SKILL.md — Orchestrator

Location: `brain/ai/skills/custom/memory/SKILL.md`

Frontmatter:
```yaml
---
name: memory
description: "Memory orchestrator. Single entry point for all memory operations — capturing preferences and facts, recalling past decisions, querying structured facts, reviewing saved entries, and maintaining/correcting memory. Accepts natural language. No commands to remember. AI-agnostic, IDE-agnostic. Works with Claude Code, Codex, and Gemini CLI."
---
```

Sections (mirrors /web and /design pattern exactly):
1. Role statement + 25+ natural language triggers
2. Standing Memory Laws (Write / Fact / Recall / Review — run silently)
3. Step 0: Classify (no intake question — classify from prompt directly)
4. Workflow A: RECALL — progressive disclosure with mem-search
5. Workflow B: CAPTURE — dedup → type select → mem-write → mem-facts (mandatory)
6. Workflow C: FACT — direct mem-facts operations
7. Workflow D: REVIEW — full index + facts + maintenance suggestions
8. Workflow E: MAINTAIN — update, deprecate, correct
9. Tool Reference Map (all mem-* commands)
10. Natural Language → Routing Guide (25+ rows)
11. AI-Agnostic & IDE-Agnostic Operation
12. Underlying Tools Remain Independent

---

## 7. Config Updates

**CLAUDE.md global:** Add `/memory` to available skills list
**brain/CLAUDE.md:** Update Memory System section — add mem-write, mem-facts, /memory orchestrator, updated promotion table
**AGENTS.md + GEMINI.md:** Update memory section to add mem-write, mem-facts, /memory reference

---

## 8. Sync

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run && \
node tools/scripts/sync-ai-skills.mjs && \
node tools/scripts/sync-ai-skills.mjs --check
```

---

## 9. Verification

```bash
# Empty facts store created
ls ~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/facts.jsonl

# mem-facts add/list/search/invalidate work
mem-facts add "Steve" "prefers" "Haiku as default model"
mem-facts list Steve
mem-facts search "Haiku"
mem-facts invalidate fact-001
mem-facts list  # fact-001 gone from active list

# mem-write creates entry + auto-writes facts
mem-write user "Steve Westhoek" "Personal info and preferences" \
  --body "Steve is founder of ProChat. Prefers concise responses." \
  --facts "Steve|role|founder,Steve|company|ProChat"
mem-search           # new entry visible in index
mem-search --id mem-user-001
mem-facts list Steve  # 2 new facts appear

# mem-search --facts works
mem-search --facts "Steve"

# Hook detects 4 intents correctly
echo '{"prompt":"remember this: I prefer Haiku"}' | bash ~/.claude/hooks/memory-recall-hook.sh | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.prompt)" | grep "capture instructions"
echo '{"prompt":"what did we decide about models"}' | bash ~/.claude/hooks/memory-recall-hook.sh | node -e "..." | grep "Memory recall"
echo '{"prompt":"what do we know about Steve"}' | bash ~/.claude/hooks/memory-recall-hook.sh | node -e "..." | grep "Facts context"
echo '{"prompt":"show all my memories"}' | bash ~/.claude/hooks/memory-recall-hook.sh | node -e "..." | grep "Memory index"

# Skill sync passes
node tools/scripts/sync-ai-skills.mjs --check  # exit 0
```

---

## Implementation Order

1. Create `facts.jsonl` (empty)
2. Create + test `mem-facts.sh` + symlink
3. Create + test `mem-write.sh` + symlink
4. Update `mem-search.sh` (add `--facts`)
5. Replace `memory-recall-hook.sh` (4-intent version)
6. Create `brain/ai/skills/custom/memory/SKILL.md` + symlink
7. Update all 4 config files (CLAUDE.md global, brain/CLAUDE.md, AGENTS.md, GEMINI.md)
8. Run sync + verify
9. Commit
