# Brain Strategy — Agentic Operating System

**Date:** 2026-05-22
**Owner:** Steve Westhoek
**Status:** Active

---

## Definition

Brain is an **agentic operating system** — it configures, constrains, and enriches multiple AI runtime harnesses (Claude Code, Codex CLI, Gemini CLI) rather than being a harness itself.

It does not own the execution loop. Claude Code, Codex, and Gemini each run their own orchestration loops (call LLM → parse output → execute tool → loop). Brain provides the configuration, policy, memory, skills, capabilities, and safety layers that shape how those loops behave.

---

## Architecture Model

```
┌─────────────────────────────────────────────────────────────┐
│                SAFETY & SCALE (Layer 3)                      │
│                                                             │
│  Guardrails policy        (ai/policy/guardrails.md)         │
│  Approval gates           (agent-approval-gates.ts)         │
│  Bash hook guards         (check-risky-command.sh)          │
│  Verification loops       (/greploop — iterative QA)        │
│  Subagent orchestration   (model routing + escalation)      │
│  Context compaction       (Gemini Flash preprocessing)      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                CAPABILITIES (Layer 2)                        │
│                                                             │
│  Memory                   (mem-write/search, CLAUDE.md,     │
│                            auto-memory, decision-log)       │
│  Context management       (skills, profiles, skill-loading) │
│  State management         (agent-ledger, task-state,        │
│                            handoff, executor-plan)          │
│  Tool scoping             (capability registry,             │
│                            safety classes, approval reqs)   │
│  Persistent codebase graph (graphify cached per-repo)       │
│  Dependency source access (opensrc — read library source)   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                RUNTIME (Layer 1)                             │
│                                                             │
│  Orchestration loop       Claude Code / Codex / Gemini      │
│  Output parsing           Built into each engine            │
│  Prompt construction      CLAUDE.md + skills + memory       │
│  Error handling           Guardrails + hooks + escalation   │
│  Tools                    20+ capabilities, MCP, CLI tools  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                LLM (Center)                                  │
│                                                             │
│  Claude    Haiku → Sonnet → Opus (escalation ladder)        │
│  Codex    low → standard → max                              │
│  Gemini   Flash → Pro                                       │
│  LM Studio local (batch window 1-7 AM)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Configure, don't replace

Brain configures the runtime harnesses. It does not rebuild them. The orchestration loop belongs to Claude Code/Codex/Gemini — they improve it weekly. Brain's job is to make each loop smarter via better prompts, skills, memory, and guardrails.

### 2. Cheapest tier first

Every task starts at the cheapest capable tier and escalates only when struggling. LM Studio (free) → Gemini Flash (free) → Haiku → Codex low → Sonnet → Codex standard → Opus → Codex max.

### 3. Skills detect intent silently

Users describe what they need in natural language. Orchestrator skills classify intent and route to sub-skills without intake questions. No commands, no tool names exposed to the user.

### 4. Safety by layer, not by hope

Four safety layers enforce independently: policy file → bash hooks → capability safety classes → approval gates. Each layer catches what the layer above misses.

### 5. Verification before shipping

Every code workflow passes through review before completion. The GrepLoop pattern automates iterative review-fix-review until clean. No manual bridge between "found issue" and "fixed issue."

### 6. Code as the documentation

AI agents read source code (via opensrc), codebase graphs (via graphify), and structured skill files (SKILL.md with frontmatter). Documentation that cannot be derived from code is stored as CLAUDE.md, AGENTS.md, and skill files — machine-readable formats that agents consume directly.

### 7. Memory is progressive disclosure

Never load all memory at once. Index first, filter by keyword, fetch full content only for relevant IDs. The same principle applies to skills (profiles limit active set) and context (compaction before escalation).

### 8. Append-only audit trail

Agent state changes are append-only with snapshot support. Ledger entries, approval events, and task state transitions are immutable once recorded. This enables resume, replay, and accountability.

---

## What Brain Provides (to Each Harness)

| Layer | What Brain Provides | Where It Lives |
|-------|-------------------|----------------|
| **Prompt construction** | System prompt hierarchy (global CLAUDE.md → repo CLAUDE.md → skills) | operations/system-configs/ |
| **Tool definitions** | Capability registry with safety classes | projects/brain-core/src/adapters/agent-capabilities.ts |
| **Memory** | 4-layer memory (global, repo, shared, decision-log) + auto-memory | ~/.brain/memory/, .ai/, CLAUDE.md |
| **Routing** | Model selection policy with escalation ladder | ai/policy/routing.md |
| **Safety** | Guardrails policy, bash hooks, approval gates | ai/policy/guardrails.md, hooks/ |
| **Skills** | Natural language orchestrators (code, design, research, web, video) | ai/skills/ |
| **State** | Agent ledger, task graph, executor plan, approval gates | projects/brain-core/ |
| **Verification** | GrepLoop (iterative review-fix), /review, /codex | ai/skills/custom/greploop/ |
| **Context** | Graphify (codebase graph), opensrc (dependency source) | tools/, ai/skills/ |

---

## What Brain Does NOT Do

- **Own the orchestration loop.** That belongs to Claude Code, Codex, Gemini.
- **Replace human judgment.** Approval gates exist for high-risk actions.
- **Store secrets.** No credentials in tracked files. Use env, keychains, ignored files.
- **Auto-commit without review.** All git mutations require explicit action.
- **Merge brain and mind.** Brain = AI system. Mind = personal knowledge. Separate repos.

---

## Strategic Priorities (2026-05 → 2026-07)

### Priority 1: Verification Loops (GrepLoop)

Build autonomous review-fix-review cycles that close the gap between "found issue" and "fixed issue" without manual intervention.

### Priority 2: Dependency Source Access (opensrc)

Give all three AI engines the ability to read actual dependency source code during debugging, architecture analysis, or code review.

### Priority 3: Persistent Codebase Graph

Cache graphify output per-repo so agents start sessions with structural understanding rather than regenerating each time.

### Priority 4: Refactoring Intelligence (code-structure)

Add service-layer extraction guidance to the /code improve workflow, activating only when cross-flow duplication is detected.

### Priority 5: SvelteKit Default for New Projects

Adopt SvelteKit as the default frontend for new web projects. Existing Next.js projects remain on Next.js. No migrations.

---

## Success Criteria

The strategy succeeds when:

1. A lower-tier model (Haiku/Codex mini) can execute a full implementation task by following the handoff and implementation plan without requiring reasoning about what to do next.
2. Code quality loops run autonomously (review → fix → re-review → clean).
3. AI agents can inspect dependency internals without human intervention.
4. Codebase graphs persist across sessions and incrementally update.
5. New web projects ship faster with less AI-generated bugs (via Svelte's simpler patterns).

---

## Relationship to Other Docs

| Document | Role |
|----------|------|
| This file | Strategic direction and architecture model |
| `brain-agentic-os-roadmap.md` | Phase timeline with goals and status |
| `brain-agentic-os-implementation-plan.md` | Executable task list for lower-tier models |
| `ai/policy/routing.md` | Model routing rules (operational) |
| `ai/policy/guardrails.md` | Safety rules (operational) |
| `operations/decision-log.md` | Confirmed decisions (append-only) |
| `.ai/current.md` | Session handoff (ephemeral) |
