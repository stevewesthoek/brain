# Code Orchestrator Quick Reference

**Last updated:** 2026-05-07  
**Status:** Live  
**Orchestrator location:** `brain/ai/skills/custom/code/SKILL.md`

---

## What `/code` Does

Turns any natural language about your code into the right toolchain — no skill names, no commands to remember.

You just say what you want:
- "This code is spaghetti, clean it up"
- "Something is broken here"
- "Review this PR / is this safe?"
- "Add this feature"
- "Document this module"
- "Ship this"

The orchestrator **detects your intent, maps your codebase if needed, plans changes, executes safely, and gates before shipping.**

---

## How to Use It

Just describe what you need. Examples:

| What you want | Just say... |
|---------------|-----------|
| Understand your architecture | "Map my codebase" / "Explain the auth flow" / "What are the main components?" |
| Improve code quality | "This code is spaghetti / too complex, clean it up" / "Refactor this / reduce coupling" |
| Fix a bug | "This is broken / not working / why is X happening?" / "Debug this" |
| Review code | "Review my code / any issues?" / "Is this safe?" / "Second opinion" |
| Build a feature | "Add this feature / implement X / create a new endpoint" |
| Document code | "Document this module / add docs / explain this function" |
| Ship to production | "Ship this / create a PR / this is ready" |
| Extract a pattern | "Save this as a reusable template / extract this pattern" |

---

## 8 Core Workflows

### Workflow A: UNDERSTAND
Maps your codebase and answers questions about architecture, data flow, dependencies, and design rationale.

**Typical flow:**
1. Build or query codebase graph (via `/graphify`)
2. Answer your question using graph data
3. Offer drill-downs: "Want me to trace a specific path?" "Explain this component?"

**Triggers:** "explain my auth flow", "what does this codebase do", "how does X connect to Y"

### Workflow B: IMPROVE
Refactors code systematically: map → identify coupling → plan → execute → review → optional overnight optimization.

**Standing rule:** Never refactor blind. Always map first to understand god nodes and surprising dependencies.

**Typical flow:**
1. Map codebase with `/graphify` (mandatory)
2. Analyze issues (circular deps, over-coupled modules, dead code)
3. Plan refactor with `/plan-eng-review`
4. Execute changes
5. Review diff with `/review`
6. Optional: `/autoresearch` to iterate overnight on measurable metrics

**Triggers:** "spaghetti code", "clean this up", "refactor", "too much coupling", "simplify"

### Workflow C: FIX
Debugs systematically: investigate → analyze → hypothesize → implement → test → optional pattern extraction.

**Standing rule:** Iron Law — no fix without confirmed root cause.

**Typical flow:**
1. Run `/investigate` (4-phase: gather evidence, pattern match, hypothesize, implement)
2. If codebase context is unclear, query graph for related modules
3. Apply surgical fix
4. Add test or assertion
5. Optional: `/learner` to extract the debugging pattern

**Triggers:** "something is broken", "bug", "not working", "crash", "debug", "error"

### Workflow D: REVIEW
Pre-landing code review: default tier checks for SQL safety, auth violations, side effects; escalates to adversarial review for auth/billing/migrations.

**Tier 1 (default):** Run `/review` — checks safety violations, structural issues.  
**Tier 2 (escalate):** Run `/codex` in challenge mode — adversarial attack findings.

**Decision logic:**
- Simple diff, no risky operations → Tier 1 only
- Auth, billing, migrations, or user explicitly asks for "adversarial" → Tier 1 + offer Tier 2

**Triggers:** "review my code", "is this safe?", "second opinion", "check this PR"

### Workflow E: BUILD
Builds features: understand existing patterns → plan → build → gate before shipping.

**Typical flow:**
1. Query existing codebase for similar patterns (reuse > invent)
2. Plan with `/plan-eng-review` for multi-file changes
3. Build following existing patterns
4. Gate with `/review` before shipping

**Triggers:** "add this feature", "implement X", "create a new endpoint", "scaffold", "build Y"

### Workflow F: DOCUMENT
Generates documentation automatically from codebase analysis and design rationale.

**Typical flow:**
1. Run `/graphify explain "[module]"` to extract what it is, what it connects to, why
2. Generate docs in project's preferred format (JSDoc, README, inline comments)
3. Emphasize design rationale (extract `# WHY:`, `# NOTE:`, `# HACK:` comments)

**Triggers:** "document this", "add docs", "explain this module", "what does this function do"

### Workflow G: SHIP
Shipping workflow: review gate → merge → PR creation → version bump → changelog update.

**Standing rule:** Always review before shipping. For destructive ops, `/careful` guardrails activate.

**Typical flow:**
1. Run `/review` (non-negotiable gate)
2. Run `/ship` (full ship workflow)
3. `/careful` guards destructive operations in production

**Triggers:** "ship this", "create a PR", "push it", "this is ready", "merge and deploy"

### Workflow H: TEMPLATE
Extracts non-obvious patterns as reusable skills for future use.

**Typical flow:**
1. Run `/graphify explain` to extract structure, dependencies, and design rationale
2. Extract pattern (identify specific vs. structural parts)
3. Save with `/learner`
4. Confirm: "Saved as [skill-name]. Use `/[skill-name]` in any project."

**Triggers:** "extract this pattern", "make this reusable", "save this as boilerplate"

---

## Standing Code Laws (Applied Silently)

These rules are enforced automatically — you'll never see them explained:

1. **Map Before Touching** — Never refactor without running graphify first. Blind refactoring breaks things.
2. **Plan Before Implementing** — Multi-file changes need a plan (`/plan-eng-review`) before code.
3. **Gate Before Shipping** — Always run `/review` before creating a PR. If destructive ops detected, `/careful` pauses and confirms.
4. **Never Truncate** — Complete, working code always. No "// ... rest of file" placeholders.
5. **Reuse Existing Patterns** — Before inventing new patterns, search the codebase for existing ones.
6. **Extract Non-Obvious Fixes** — After complex debugging, offer `/learner` to save the pattern.
7. **Scope Discipline** — Do exactly what you asked. No scope creep, no "while we're at it" refactors.

---

## 12 Underlying Tools (Orchestrated, Not User-Facing)

| Tool | When | Role |
|------|------|------|
| `/graphify` | UNDERSTAND, BUILD, IMPROVE, DOCUMENT, TEMPLATE | Map codebase, extract design rationale |
| `/investigate` | FIX | Debug with 4-phase systematic analysis |
| `/plan-eng-review` | IMPROVE, BUILD | Lock in architecture before implementing |
| `/review` | REVIEW, SHIP | Pre-landing gate, checks safety violations |
| `/codex` | REVIEW (Tier 2) | Adversarial review for high-stakes changes |
| `/ship` | SHIP | PR creation, version bump, changelog |
| `/careful` | IMPROVE, SHIP | Auto-activate guardrails for destructive ops |
| `/learner` | FIX, TEMPLATE | Extract and save reusable patterns |
| `/autoresearch` | IMPROVE | Iterate overnight on measurable metrics |
| `/autoplan` | BUILD | Large feature planning with CEO/design/eng reviews |
| `/benchmark` | IMPROVE | Performance analysis and optimization |
| `/retro` | UNDERSTAND | Historical git analysis for context |

**User never needs to know these exist.** The orchestrator handles routing automatically.

---

## Five Key Principles

### 1. No Skill Names Required
You never say "/graphify" or "/investigate". Just describe what you need: "this code is broken" routes to `/investigate` automatically.

### 2. Single Natural Language Entry Point
Say anything about your code. The orchestrator classifies intent without asking questions.

### 3. Map-Plan-Execute-Gate Pattern
For complex changes, always follows this flow: understand structure → plan → execute → review before shipping.

### 4. Scope Discipline
Each workflow does exactly what was asked — no unauthorized cleanup, no "while we're at it" refactors.

### 5. Underlying Tools Remain Independent
Power users can still call `/graphify`, `/investigate`, `/review`, etc. directly if they prefer the CLI. Both paths coexist.

---

## Natural Language Examples (Non-Exhaustive)

| Intent | Example | Workflow |
|--------|---------|----------|
| UNDERSTAND | "Map my codebase" | A |
| UNDERSTAND | "Explain the auth flow" | A |
| UNDERSTAND | "What are the main components?" | A |
| UNDERSTAND | "How does X connect to Y?" | A |
| IMPROVE | "This code is spaghetti" | B |
| IMPROVE | "Clean this up" | B |
| IMPROVE | "Reduce coupling between X and Y" | B |
| IMPROVE | "Optimize this for performance" | B |
| IMPROVE | "Is there tech debt?" | B |
| FIX | "Something is broken here" | C |
| FIX | "This test is failing / debug this" | C |
| FIX | "Why is X happening?" | C |
| REVIEW | "Review my code" | D |
| REVIEW | "Is this SQL safe?" | D |
| REVIEW | "Second opinion / adversarial challenge" | D |
| BUILD | "Add this feature" | E |
| BUILD | "Implement X / create a new endpoint" | E |
| BUILD | "Scaffold Y / create boilerplate" | E |
| DOCUMENT | "Document this module" | F |
| DOCUMENT | "Add JSDoc / write a README" | F |
| SHIP | "Ship this / create a PR" | G |
| SHIP | "This is ready, push it" | G |
| TEMPLATE | "Extract this pattern" | H |
| TEMPLATE | "Save this as a reusable template" | H |

---

## AI-Agnostic, IDE-Agnostic

Orchestrator works identically on:
- Claude Code (primary)
- Codex CLI (code review escalation)
- Gemini CLI (bulk codebase preprocessing)
- Cursor IDE
- Kiro IDE
- Antigravity
- All IDEs with `~/.claude/skills` symlink

Same SKILL.md file, same routing, same 8 workflows — no CLI-specific variations.

---

## Integration with Other Skills

| Skill | Complementary Use |
|-------|------------------|
| `/design` | Code orchestrator handles logic/architecture; design orchestrator handles visual/UX |
| `/memory` | Use to recall past debugging patterns or code decisions |
| `/web` | For web-specific build tasks, `/web` handles research; `/code` handles integration |
| `/graphify` | Used internally by `/code` for understanding workflows |
| `/learner` | Triggered by `/code` after complex fixes or pattern extractions |

**Do NOT invoke other skills mid-code session** — let the orchestrator handle everything.

---

## Performance

| Task | Typical Time | Notes |
|------|-----|-------|
| Understand small codebase (<100 files) | 1–2 min | Graph generation + query |
| Understand large codebase (100–500 files) | 5–10 min | 2–5 parallel semantic subagents |
| Review code | 30–60s | Tier 1 review only |
| Review + escalate (high-risk) | 2–5 min | Tier 1 + Tier 2 adversarial review |
| Fix simple bug | 2–5 min | Investigate + implement + test |
| Fix complex bug | 10–30 min | Investigate may need graphify context |
| Build feature | Varies | Depends on plan + implementation complexity |
| Ship to production | 5–10 min | Review + ship workflow |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "I want to understand my codebase but it's huge" | Start with `/graphify .` directly to get the full map in one pass. The orchestrator will use the cached graph for subsequent queries. |
| "I want to improve code but don't know where to start" | Say "What's the tech debt?" — orchestrator will map the codebase, identify god nodes and surprising connections, and offer the highest-value refactoring opportunity. |
| "I need to debug something complex" | Say "This is broken: [description]" — orchestrator runs `/investigate` with full context awareness and offers `/learner` to save the pattern. |
| "I want to review code from a different repo" | Switch to that repo first (`cd ~/Repos/other-project`), then use `/code`. Each repo has its own graph cache. |
| "Review is too aggressive / I want a lighter pass" | Say "light review" or "just check for syntax" — the orchestrator will adjust review strictness. |
| "I want to know the exact tools being used" | Specify: "Show me which tools you're using" — orchestrator will name them. But you don't need to know this for normal usage. |

---

## Key Files

- **Orchestrator:** `brain/ai/skills/custom/code/SKILL.md` (~600 lines)
- **Symlink:** `brain/ai/skills/active/code -> ../custom/code`
- **Config additions:** `~/.claude/CLAUDE.md`, `brain/CLAUDE.md`, `AGENTS.md`, `GEMINI.md`
- **This runbook:** `brain/operations/runbooks/code-orchestrator.md`

---

## Status

- **Live:** Ready for use across all AI engines
- **Orchestrator version:** 1.0 (initial release)
- **Underlying tools:** All present and synced across Claude Code, Codex, Gemini CLI, Cursor, Kiro, Antigravity
- **Skill sync:** All checks pass (exit 0)

---

## For Power Users

If you know exactly which tool to use, call it directly via CLI or skill:

```bash
/graphify .                                    # Full pipeline
/graphify query "my question"                  # Query existing graph
/investigate "describe the issue"              # Debug workflow
/review < diff.patch                           # Code review
/ship                                          # Create PR and push
```

The orchestrator and direct CLI paths coexist and are fully compatible.

---

## Natural Language is All You Need

Remember: **You never need to know `/code` is an orchestrator, that it routes to 12 tools, or what those tools are called.**

Just describe your coding need in natural language, and the orchestrator detects intent, routes to the right toolchain, enforces best practices (map-before-touching, plan-before-implementing, gate-before-shipping), and handles everything.

---

## For Next Level

After solving a problem with the orchestrator, ask:
- "Extract this as a reusable skill" → `/learner` saves the pattern
- "What did we learn?" → Review findings and extractable patterns
- "Can this be automated?" → Use the pattern to build a custom skill for repeated scenarios

---

## References

- **Orchestrator source:** `brain/ai/skills/custom/code/SKILL.md`
- **Related orchestrators:** `/design`, `/web`, `/memory` (same pattern)
- **Runbooks:** `operations/runbooks/graphify-quick-reference.md`, `operations/runbooks/investigate.md`, etc.
- **Config:** `brain/CLAUDE.md` (Code Orchestrator section), `~/.claude/CLAUDE.md`

---

## Remember

The `/code` orchestrator is invisible by design. You don't think about it — you just talk to your AI about your code, and the right toolchain runs automatically. No skill names, no commands, no tool knowledge needed.

**Just describe what you need.** The orchestrator handles the rest.
