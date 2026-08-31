# Shared Memory System

**Status:** Live (core tools + Claude hook). Automatic injection for Codex/Gemini: planned.
**Last updated:** 2026-05-22
**Related:** `memory-orchestrator.md` (component detail), `mind-compile-loop.md` (planned vault layer)

---

## Why this system exists

Memory belongs to the user, not to any AI. A decision made in a Claude session should be retrievable in a Codex session the next day without repeating yourself. Without a shared store, each AI accumulates its own isolated context and the user becomes the synchronization layer — re-explaining preferences, decisions, and constraints every time they switch tools.

The system has one governing principle:

> One memory store. Any AI can read it. Any AI can write it. No AI owns it.

This also means the system is portable. If Claude is replaced by a better model tomorrow, the memory goes with the user, not the model.

---

## Architecture — three layers

```
~/.brain/memory/          ← shared store (canonical)
  MEMORY.md               index: one line per entry, always loaded first
  *.md                    individual memory files (fetched by ID when needed)
  facts.jsonl             structured entity-predicate-object facts

mind/ (Obsidian vault)    ← long-term personal knowledge
  capture/inbox/          raw incoming captures
  wiki/                   compiled durable knowledge
  sources/research/       research notes, apologetics, Bible, business
  live/                   active tasks, projects, decisions

~/.claude/projects/.../memory/   ← Claude session scratchpad (Claude-private)
  auto-memory files       Claude Code auto-saves corrections here during sessions
```

**Why three layers instead of one:**
- `~/.brain/memory/` is small, structured, AI-readable. It stores preferences, decisions, facts. Not full documents.
- The vault is large, human-readable, Obsidian-browsable. It stores knowledge, research, strategy. Too large to inject into every AI context.
- The Claude scratchpad is ephemeral session corrections. Not worth sharing — it's noise from the working session.

**Progressive disclosure is the read pattern:**
1. Always load `MEMORY.md` index first (~1-2k tokens)
2. Search by keyword when you need a topic
3. Fetch full file only by explicit ID when you need the detail

Never load the entire store into context. The index is the entry point.

---

## The four tools

### `mem-write` — create or update a memory entry

```bash
mem-write user|feedback|project|ref <name> <description> [--body "..."] [--facts "entity|predicate|object,..."]
mem-write update <mem-id> [--name "..."] [--description "..."] [--body "..."]
```

**Location:** `brain/tools/scripts/mem-write.sh` → symlink `~/.local/bin/mem-write`

**Why:** The only write path into the shared store. Forces consistent frontmatter (id, name, type, description). Auto-registers the entry in `MEMORY.md` index.

**Design choice — four types only:**
- `user` — who Steve is, his role, preferences, expertise
- `feedback` — how AI should behave, what to avoid, what works (corrections AND confirmations)
- `project` — current work context, decisions, status, deadlines
- `ref` — pointers to external resources (APIs, tools, services, channels)

Why four? Enough to be useful for routing. Few enough that classification is unambiguous.

---

### `mem-search` — read and query

```bash
mem-search                      # list index (default)
mem-search <keyword>            # search index + files
mem-search --id <mem-id>        # fetch full file
mem-search --full <keyword>     # full content of all matches
mem-search --facts <keyword>    # search structured facts
```

**Location:** `brain/tools/scripts/mem-search.sh` → symlink `~/.local/bin/mem-search`

**Why:** Read path uses progressive disclosure. Agents call `mem-search` without args to get the index first, then narrow. This keeps token cost proportional to actual need.

---

### `mem-facts` — structured facts engine

```bash
mem-facts add <entity> <predicate> <object> [--since YYYY-MM-DD] [--source <mem-id>]
mem-facts list [entity]
mem-facts search <keyword>
mem-facts invalidate <fact-id>
```

**Location:** `brain/tools/scripts/mem-facts.sh` → symlink `~/.local/bin/mem-facts`
**Data:** `~/.brain/memory/facts.jsonl` — append-only, never delete lines

**Why facts separate from memory files:** Memory files are narratives (paragraphs, context). Facts are atomic (entity-predicate-object triplets). Facts are machine-queryable without reading prose. Example: `Steve | works-from | Lisbon` is instantly filterable; the same fact buried in a memory file body requires text search.

**Invalidation:** Never delete facts. Append a new line with `valid_to` set. Append-only = auditable history.

---

### `memory-recall-hook.sh` — automatic context injection for Claude

**Location:** `~/.claude/hooks/memory-recall-hook.sh`
**Trigger:** `UserPromptSubmit` — runs on every Claude Code prompt before the AI sees it

**What it does:** Detects intent in the user's prompt and injects relevant memory context automatically. Four intents, in detection order:

| Intent | Trigger phrases | What gets injected |
|--------|----------------|-------------------|
| REVIEW | "show all my memories", "memory overview" | Full index + all facts |
| FACTS | "what do we know about X", "facts about X" | Facts for entity X + related memory entries |
| CAPTURE | "remember this", "save this", "I prefer" | Instructions for how to write the memory |
| RECALL | "what did we", "remind me", "what is our" | Top keyword-matched memory entries |

**Why automatic:** The user should never have to say "load my memory first". If the prompt sounds like it needs memory, memory is injected. If not, the hook passes through silently (zero cost).

**Claude-only limitation:** Claude Code has a `UserPromptSubmit` hook API. Codex and Gemini do not expose equivalent hooks. See "AI coverage" below.

---

## AI coverage

| Agent | mem-* tools | Automatic injection | Status |
|-------|-------------|--------------------|----|
| Claude Code | ✓ shell access | ✓ via UserPromptSubmit hook | Live |
| Codex CLI | ✓ shell access | ✓ via `~/.brain/memory-context.md` (passive read at session start) | Live |
| Gemini CLI | ✓ shell access | ✓ via `~/.brain/memory-context.md` (passive read at session start) | Live |
| Any new AI | add shell access | include memory-context.md pointer | 2 steps |

**How passive injection works:** `~/.brain/memory-context.md` may be generated
by the explicit memory-context refresh procedure. The Brain Scheduler's
`memory-context-refresh` entry is currently disabled, so the file is not a
guaranteed nightly artifact. Agents should read it when present and fall back
to `mem-search` when it is absent or stale. AGENTS.md and GEMINI.md document
that startup path.

**Difference from Claude hook injection:** Claude's hook injects memory into every prompt automatically, triggered by intent detection. Codex/Gemini read `memory-context.md` once at session start — same information, passive pattern.

---

## What NOT to store

Never put these in `~/.brain/memory/`:
- Secrets, tokens, API keys, passwords, credentials
- Runtime logs, machine state, Brain Core output
- One-off debugging sessions or error traces
- Transient task lists or temporary notes
- Speculative ideas that haven't been confirmed
- Information only relevant to the current working session

Why: the shared store is injected into AI contexts. Secrets become exposed. Noise degrades signal. Keep it small and stable.

---

## The `BRAIN_MEMORY_DIR` environment variable

All three mem-* scripts respect:

```bash
BRAIN_MEMORY_DIR="${BRAIN_MEMORY_DIR:-$HOME/.brain/memory}"
```

Override for testing:
```bash
BRAIN_MEMORY_DIR=/tmp/test-memory mem-write user test-entry "test" --body "test body"
```

Default is always `~/.brain/memory/`. No configuration needed in normal use.

---

## Adding a new AI agent

Two steps:

1. Ensure the agent has shell access to `mem-search`, `mem-write`, `mem-facts` (already in `~/.local/bin/`).
2. Add to the agent's startup config:
   ```
   Shared memory: ~/.brain/memory/ — read with mem-search, write with mem-write.
   Memory context summary: ~/.brain/memory-context.md (manual/on-demand; not scheduler-managed).
   ```

That is all. The agent immediately has full read/write access to the same memory store as Claude and Codex.

---

## Quick reference

```bash
# Save a preference
mem-write feedback "prefer-direct-answers" "User wants direct answers, no preamble" \
  --body "Do not start responses with 'Great question' or 'Certainly'. Get to the point."

# Save a project decision
mem-write project "stb-pipeline-status" "Says the Bible pipeline current state" \
  --body "Phase 2 complete. YouTube uploads working. Pinterest pending OAuth fix."

# Add a fact
mem-facts add "Steve" "works-from" "Lisbon, Portugal"
mem-facts add "ProChat" "status" "active SaaS product"

# Search memory
mem-search                      # show full index
mem-search stb                  # find entries about stb
mem-search --id mem-project-001 # read full entry

# Recall facts
mem-facts list Steve            # all facts about Steve
mem-facts search ProChat        # search facts for keyword
```

---

## File locations

| File | Purpose |
|------|---------|
| `~/.brain/memory/MEMORY.md` | Index — always the first read |
| `~/.brain/memory/*.md` | Individual memory entries |
| `~/.brain/memory/facts.jsonl` | Structured facts (append-only) |
| `~/.brain/memory-context.md` | Optional compact summary generated by the explicit refresh procedure; not a scheduler receipt |
| `brain/tools/scripts/mem-*.sh` | Source scripts (committed to brain repo) |
| `~/.local/bin/mem-*` | Symlinks — callable from any shell |
| `~/.claude/hooks/memory-recall-hook.sh` | Claude automatic injection hook |

---

## Planned work

**Item 1 — Automatic context injection for Codex/Gemini ✓ Live**
`~/.brain/memory-context.md` is generated only when the explicit
`brain/tools/scripts/memory-context-refresh.sh` procedure is invoked. It is
not wired into the production Brain Scheduler. Codex reads it via AGENTS.md
instruction at session start when present; Gemini reads it via GEMINI.md.
Missing or stale context falls back to `mem-search`. Adding a new AI still
requires one startup pointer and the same fallback rule.

**Item 2 — Mind compile loop ✓ Live (Phase 1 — suggest-only)**
`brain/tools/scripts/mind-compile-loop.sh` runs nightly. Reads `capture/inbox/*.md`, classifies each file by frontmatter (`para_type`, `type`) and content heuristics, appends proposed moves to `mind/wiki/log.md`. No files are moved — human reviews proposals and approves manually.

Classification rules:
- `para_type=project` → propose `live/projects/<slug>.md`
- `para_type=task` → propose append to `live/tasks.md`
- `para_type=area` → propose `wiki/areas/<slug>.md`
- `para_type=resource|reference` → propose `sources/research/<slug>.md`
- `type=decision` → propose append to `live/decisions.md`
- Anything else → propose `wiki/<slug>.md`

Files with `compiled: true` in frontmatter are skipped (already processed).

Phase 2 (future): implement approved moves after review workflow is stable.

**Item 3 — NotebookLM integration assessment ✓ Assessed**

NotebookLM CLI is already installed (`notebooklm-py 0.3.4` via pipx). The `/notebooklm` skill and `operations/runbooks/notebooklm.md` document full usage.

**Suitable content found in `sources/research/`:**

| Folder | Content | Why NotebookLM | Size |
|--------|---------|----------------|------|
| `apologetics/atheism-dialogue-001/` | Multi-document dialogue: original paper, atheist response, Steve's reply (~200k chars) | Deep topical synthesis, argument mapping, audio podcast for review | Very high |
| `apologetics/gospel-dialogue-001/` | Gospel legal framework series, follow-up letter drafts | Synthesis, argument refinement | High |
| `apologetics/steve-apologetics-voice-and-debate-standard.md` | 17k char debate standards doc | Source for NotebookLM to ingest alongside dialogues | Medium |
| `bible/passages/`, `bible/topics/` | Bible study notes | Cross-reference synthesis, theological audio | Moderate |
| `bible/theological-questions/` | Theological questions research | Q&A synthesis | Moderate |

**Recommended wiring (not yet implemented):**

1. **Apologetics notebook** — Create a permanent NotebookLM notebook named "Apologetics Research". Add all `atheism-dialogue-001/` + `gospel-dialogue-001/` sources during an explicit review cadence. Generate audio summary monthly.
2. **Bible studies notebook** — Create a notebook for `bible/` research notes. Add passages + topics + theological questions. Generate audio overview monthly.
3. **Separate automation proposal** — NotebookLM sync was assessed but is not wired into the Brain Scheduler. Any future automation needs its own approved scope, credentials, idempotency, and deployment review.

**Security constraint:** NotebookLM runs via Google account. All content uploaded becomes Google-hosted. Do not upload: `.env` files, credentials, raw auth tokens, personal financial data, or private medical info. Research notes and theological content are acceptable.

**Status:** Assessment complete. Wiring is a separate implementation task. See `operations/runbooks/notebooklm.md` for CLI reference.
