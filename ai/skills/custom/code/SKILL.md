---
name: code
description: Master code orchestrator. Single entry point for ALL coding work — understanding codebases, improving code quality, fixing bugs, reviewing code, building features, documenting, and shipping. Accepts any natural language about code. No skill names, no commands, no tool knowledge required. Just describe what you need. AI-agnostic, IDE-agnostic. Works with Claude Code, Codex, Gemini CLI, Cursor, Kiro, and all IDEs.
---

# Code — Master Orchestrator

You are the **single entry point** for all coding work. When the user says anything about their code — understanding it, improving it, fixing it, reviewing it, building on it, documenting it, or shipping it — this orchestrator runs.

The user does not know (and should not need to know) that `/graphify`, `/investigate`, `/review`, `/greploop`, `/codex`, `/plan-eng-review`, `/learner`, `/ship`, `/careful`, `/autoresearch`, `/autoplan`, or `/benchmark` exist. Your job is to know when to invoke each one, in what order, and why.

**Dormant subskill rule:** Some referenced engineering subskills may not be active in the default skill profile. Do not treat that as absence. Use `docs/skills/skill-index.md` and the relevant profile files under `docs/skills/profiles/` to locate or activate the needed sub-capabilities. Preserve natural-language routing: the user should not need to remember subskill names.

**Natural language triggers (non-exhaustive):**
- "this code is spaghetti, clean it up"
- "I want to understand my auth flow"
- "something is broken / this isn't working"
- "review my code / is this safe?"
- "add a new feature"
- "create a template / boilerplate"
- "document this module"
- "refactor this into something cleaner"
- "ship this / create a PR"
- "what does this codebase do?"
- "is there tech debt?"
- "extract this pattern / make it reusable"

---

## Standing Code Laws (Apply Silently)

Apply these silently — never explain them to the user.

Before adding new permanent laws here, classify the rule with `docs/rules/rule-onboarding-and-hook-policy.md`. Deterministic command/path/diff rules belong in hooks or CI when feasible; `/code` should keep judgment-based orchestration rules such as routing, architecture, review interpretation, and scope discipline.

### Law 1: Map Before Touching
When the intent is IMPROVE, never refactor without running `/graphify` first. Blind refactoring breaks things. The map reveals what's safe to decouple, what's tightly coupled, and what the god nodes (over-connected modules) are.

### Law 2: Plan Before Implementing
For any change touching more than one file, lock in a plan before writing code. Use `/plan-eng-review` for existing code analysis, `/autoplan` for large features with design docs. A plan prevents scope creep and regrets.

### Law 3: Gate Before Shipping
Always run `/review` before PR creation. No exceptions. Deterministic shipping/destructive-command confirmations are enforced by Claude hooks; `/code` keeps the judgment rule: interpret review results, stop on blocking findings, and only proceed when the user intent and evidence are clear.

### Law 3a: Loop Only When Review Findings Need Autonomous Fixes
Use dormant `/greploop` automatically when the user asks for review findings to be fixed without manual bridging, or when a review gate finds concrete fixable issues and the user's intent is to keep improving until clean. Do not use it for single obvious fixes, architecture-level redesign, non-code reviews, or contradictory review findings. GrepLoop is a bounded review-fix-review loop, not a general refactor license.

### Law 4: Never Truncate
Output complete, working code. Never truncate files with "// ... rest of file" or similar comments. Partial code is unusable. Full files, always.

### Law 5: Reuse Existing Patterns
Before adding a new pattern, search the codebase for existing ones using `/graphify query "how is [similar thing] implemented?"`. Consistency beats novelty. Use what's already there.

### Law 6: Extract Non-Obvious Fixes
After any FIX workflow that required real investigation and problem-solving (not just a typo), run `brain-learn-failures --repo . --write-report` when session logs may contain repeated failed paths, command forms, or local runtime gotchas. Then offer `/learner` only for patterns that pass the quality gate. The hard-won insight should be saved so it's never rediscovered from scratch.

### Law 7: Scope Discipline
Do exactly what was asked. An IMPROVE request on one module doesn't mean touching other modules. A FIX request doesn't mean cleaning up unrelated code. Scope creep introduces regressions and wastes time.

---

## Step 0: Classify Intent (No Intake Question)

No intake question needed. Classify directly from the user's message.

**Detect intent** by looking for key words and signals:

| Intent | Key words / signals |
|--------|-------------------|
| `UNDERSTAND` | "understand", "explain", "what does", "map", "architecture", "data flow", "how does X work", "what are the dependencies" |
| `IMPROVE` | "spaghetti", "clean up", "refactor", "improve quality", "simplify", "too complex", "make it better", "reduce coupling" |
| `FIX` | "broken", "bug", "not working", "error", "crash", "failing test", "why is X happening", "debug" |
| `REVIEW` | "review", "second opinion", "is this safe", "check my code", "any issues", "SQL safe", "trust boundary" |
| `BUILD` | "add feature", "create", "build", "implement", "generate", "boilerplate", "scaffold", "new endpoint" |
| `DOCUMENT` | "document", "explain this module", "add docs", "what does this function do", "JSDoc", "write comments" |
| `SHIP` | "ship", "push", "create PR", "merge", "deploy this", "this is ready", "publish" |
| `TEMPLATE` | "template", "reusable", "extract pattern", "boilerplate from this", "save this pattern" |

**Detect scope** (as a modifier):

| Scope | Signal |
|-------|--------|
| `GREENFIELD` | "new project", "start from scratch", "blank slate" |
| `PROJECT` | "my codebase", "my project", entire repo mentioned, no specific file/module mentioned |
| `MODULE` | Specific folder, module, or feature mentioned (e.g., "auth module", "payment service") |
| `FILE` | Specific file mentioned by name or path |
| `DIFF` | "this PR", "this diff", "these changes" |

---

## Workflow A: UNDERSTAND

**Trigger:** "explain my auth flow", "what does this codebase do", "map my dependencies", "I want to understand X"

### A1. Check for existing graph

```bash
if [ -f graphify-out/graph.json ]; then
  GRAPH_EXISTS=true
else
  GRAPH_EXISTS=false
fi
```

### A2a. If no graph exists: Run graphify

If `graphify-out/graph.json` does NOT exist, invoke `/graphify` with MAP intent:

> "Map my codebase — I want to understand [the specific area of interest]."

This runs the full Graphify pipeline: detect corpus → AST + semantic extraction → community detection → god nodes analysis → HTML + markdown report + JSON graph.

### A2b. If graph exists: Query it

If `graphify-out/graph.json` EXISTS, query the graph directly using `/graphify query`:

> "Query my graph: [user's specific question about the codebase]"

### A3. Present findings

Return findings in plain English (no graph jargon):
- Use "module", "component", "connection" — NOT "node", "edge", "god node"
- If GRAPH_EXISTS=true, use query results directly
- If no graph, summarize the god nodes, surprising connections, and suggested questions from the fresh map

### A4. Offer drill-downs

> "Want me to trace a specific path between modules? Or explain a specific component in detail? Or see what changed recently?"

**Optional offers:**
- Scope=PROJECT → suggest full graphify pipeline
- Scope=MODULE → suggest `/graphify explain "[module name]"`
- User asks "what changed recently?" → mention `/retro` available for git history + author breakdown

---

## Workflow B: IMPROVE

**Trigger:** "spaghetti code", "clean this up", "refactor", "too much coupling", "simplify", "improve quality"

This is the flagship workflow — map-plan-execute-gate with high stakes.

### B1. Map first (mandatory)

Invoke `/graphify` on the target (scope: PROJECT, MODULE, or FILE):

> "Map my [scope] so I can understand what needs improving. Focus on coupling, dependencies, and design structure."

This is mandatory. Never refactor blind. The graph reveals:
- God nodes (over-connected modules doing too much)
- Surprising connections (unexpected cross-module dependencies)
- Community structure (natural clustering)
- Circular dependencies (red flags)

### B2. Analyze and identify issues

From the graph report (GRAPH_REPORT.md), identify:
- Which modules are god nodes (too many connections)?
- Which dependencies are surprising or suspicious?
- What suggests circular dependencies or tight coupling?
- Any community structure that reveals natural extraction boundaries?

Summarize: "From the graph, I see these issues: [list 3-5 specific coupling issues]."

### B3. Plan the refactor

Invoke `/plan-eng-review` on the identified issues:

> "Here's what I see in the codebase: [describe coupling issues from graph]. Plan a refactor to address these. What should I extract, simplify, or decouple?"

This locks in:
- What to extract into separate modules
- What to simplify or consolidate
- What dependencies to sever
- Edge cases and test strategy

### B4. Execute (follow the plan exactly)

Apply changes file by file. Never deviate from the plan. Never "improve" beyond what was planned. Scope discipline.

### B5. Gate with review

After changes are complete, invoke `/review` on the diff:

> "Review my refactoring diff. Did I introduce any new issues? Is the code safer/cleaner now?"

### B6. Offer autoresearch (optional)

If there's a measurable metric (test coverage score, complexity metric, performance benchmark), offer `/autoresearch`:

> "Want me to iterate on this overnight using a measurable metric like [coverage/complexity/performance]?"

**Standing rule:** Never execute without map + plan + gate. Map → Plan → Execute → Gate.

---

## Workflow C: FIX

**Trigger:** "something is broken", "this bug", "not working", "crash", "error", "debug", "failing test"

### C1. Iron Law: Root Cause First

Do not propose a fix before confirming the root cause. This is non-negotiable. Never guess.

Invoke `/investigate`:

> "This is broken: [describe the symptom, error, or failing behavior]. Find the root cause. Go through your 4 phases: investigate, analyze, hypothesize, implement verified fix."

The `/investigate` skill will:
1. Gather evidence (logs, stack traces, error messages, code inspection)
2. Analyze patterns (what changed recently? what's similar?)
3. Hypothesize candidate causes
4. Implement and verify the fix

### C2. If investigation needs codebase context

If the investigation finds it inconclusive and the cause is likely architectural or involves multiple modules, run `/graphify query`:

> "Query the graph: [describe the error]. Which modules could be involved?"

This surfaces related modules and their connections, helping narrow down the root cause.

### C3. Apply the fix

After root cause is confirmed:
- Apply the fix surgically. Only touch what the root cause analysis identified.
- Never use this as an excuse to clean up unrelated code. Scope discipline.

### C4. Regression guard

Add a test or assertion for the fix if one doesn't exist. Prevent this from breaking again.

### C5. Extract pattern (if complex)

If the fix required non-obvious investigation or problem-solving, offer `/learner`:

> "This required real debugging. Want me to extract the pattern so we never have to rediscover this from scratch?"

Before promotion, run `brain-learn-failures --repo . --write-report` if repeated local failures occurred during the session. Use the report as evidence; do not promote generic command failures.

Save it to `brain/ai/skills/custom/learned/` for reuse in future projects.

---

## Workflow D: REVIEW

**Trigger:** "review my code", "is this safe", "second opinion", "any issues with this PR", "check this diff"

Two review tiers based on risk:

### D1. Tier 1 (Default) — Pre-Landing Review

Invoke `/review`:

> "Review this code for: SQL safety, LLM trust-boundary violations, conditional side effects, structural issues."

Produces a pass/fail verdict + categorized issue list.

### D2. Tier 2 (Escalate for High Risk) — Adversarial Review

Escalate to `/codex` in challenge mode ONLY when:
- The diff touches auth, billing, migrations, or database schema
- The diff involves prod-touching code or infrastructure
- The user explicitly asks for "adversarial", "challenge mode", or "be harsh"

> "Give me an adversarial second opinion on this diff. Be harsh. Find any vulnerabilities, edge cases, or design flaws."

### D3. Decision Logic

- `scope=DIFF` and no risky keywords detected → Tier 1 only
- `scope=DIFF` and auth/billing/DB/migration keywords detected → Tier 1 + offer Tier 2
- User explicitly says "adversarial" or "challenge mode" → Tier 2 directly

### D4. If findings are concrete and user intent implies auto-fix, run GrepLoop

Invoke dormant `/greploop` automatically when review returns concrete, fixable findings and the user asked for any of these outcomes in natural language:
- "fix all review issues"
- "keep going until clean"
- "review and fix automatically"
- "make it pass review"
- "handle whatever the review finds"

Do not ask the user to invoke `/greploop`; the orchestrator owns that routing. GrepLoop runs `/review`, applies only the specific fixes review identified, verifies, and repeats up to 3 iterations. If findings are architectural, contradictory, risky/destructive, or outside the requested scope, do not loop; summarize and ask for direction.

### D5. Summarize findings

Present findings clearly:
- Tier 1 findings: "Review passed / failed. Issues: [list]"
- Tier 2 findings: "Adversarial review found: [attack vectors, edge cases]"
- GrepLoop result: "Clean after N iteration(s)" or "N issues remain after max iterations; manual review recommended."

---

## Workflow E: BUILD

**Trigger:** "add this feature", "create a new endpoint", "scaffold X", "build Y", "implement Z"

### E1. Understand existing patterns

Invoke `/graphify query` to find existing patterns:

> "Query the graph: How is [similar feature] currently implemented in this codebase?"

Don't invent new patterns when existing ones exist. Consistency beats novelty (Law 5).

### E2. Plan (for multi-file changes)

For anything beyond a simple single-file function, invoke `/plan-eng-review`:

> "Here's what I want to build: [description]. Plan it. Lock in: architecture, data flow, edge cases, test strategy."

For large features with existing design docs, use `/autoplan` to run CEO + design + eng reviews with auto-decisions.

### E3. Build (follow the plan)

Implement exactly as planned. Reuse patterns found in E1. Full code, never truncated (Law 4).

### E4. Gate with review

Invoke `/review` on the new code:

> "Review my new code. Is it safe? Does it follow the codebase patterns?"

### E5. Build Defaults for New Web Projects

When the user requests a new web project (greenfield, new app, fresh start):

- **Default frontend:** SvelteKit + TypeScript + Tailwind + shadcn-svelte
- **Default backend:** Supabase (self-hosted) + Drizzle ORM
- **Default deployment:** Vercel or Cloudflare (via SvelteKit adapter)

Only use Next.js if:
- The user explicitly requests React/Next.js
- The project requires a React-only library with no Svelte equivalent
- The project needs React Native for mobile companion

Do not ask the user which framework to use — default to SvelteKit silently. If they want React, they will say so.

---

## Workflow F: DOCUMENT

**Trigger:** "document this module", "add docs", "explain this module", "write JSDoc", "what does this do (for docs)"

### F1. Extract structure and rationale

Invoke `/graphify explain "[module or function name]"`:

> "Explain this module: [name]. Show what it is, what connects to it, why those connections matter, and design rationale from comments."

### F2. Generate documentation

From the graphify explain output, generate documentation in the project's preferred format:
- JSDoc/TSDoc for functions and classes
- README section or module-level comments
- Inline comments for complex logic

### F3. Emphasize design rationale

Extract and emphasize the "WHY":
- `# WHY:` comments
- `# NOTE:` comments
- `# HACK:` comments
- Docstring rationale

These are the most valuable for future maintainers and are most often missing.

### F4. For module-level docs

If documenting an entire module:
1. Run full `/graphify` pipeline (if no graph exists)
2. Use community labels to understand module boundaries
3. Write a proper module README with architecture, usage, and design rationale

---

## Workflow G: SHIP

**Trigger:** "ship this", "create a PR", "push it", "this is ready", "merge and deploy"

### G1. Review gate (mandatory)

Invoke `/review`:

> "Final review before shipping. Check for any issues."

If `/review` finds problems and the issues are concrete, fixable, and within the requested scope, route through dormant `/greploop` automatically instead of making the user manually bridge review findings into fixes. Never ship broken code. If GrepLoop reaches max iterations or reports unresolved/risky findings, stop and report the remaining issues before shipping.

### G2. Run ship workflow

Invoke `/ship`:

> "Ship it. Merge base, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR."

### G3. For production / destructive ops

If the diff involves production code, database migrations, or destructive operations, preserve a conservative shipping posture: use `/careful` for judgment-heavy risk review, and rely on Claude hooks for deterministic command confirmations such as destructive git cleanup, deploys, risky database mutations, and generated/runtime artifact staging.

> "This involves production / destructive ops. Use /careful for risk review before shipping."

---

## Workflow H: TEMPLATE

**Trigger:** "extract this pattern", "make this reusable", "create a template from this", "save this as boilerplate"

### H1. Extract structure

Invoke `/graphify explain` on the relevant code section:

> "Explain this code section: [name/path]. Show structure, dependencies, and design rationale."

### H2. Extract the pattern

Identify what's specific (names, values) vs. structural (the reusable pattern itself). Parametrize the specific parts.

### H3. Save with learner

Invoke `/learner`:

> "Extract this pattern as a reusable skill. Save it to brain/ai/skills/custom/learned/."

### H4. Confirm

> "Saved as [skill-name]. Invoke with `/[skill-name]` in any project."

---

## Tool/Skill Reference Map

| Tool | Skill | Workflows | When to use |
|------|-------|-----------|-------------|
| `/graphify` | `vendors/safishamsi/graphify/SKILL.md` | A, B, F, H | Foundation: map first for UNDERSTAND/IMPROVE/DOCUMENT; query for pattern discovery |
| `/investigate` | `vendors/gstack/investigate/SKILL.md` | C | All FIX workflows; iron law: no fix without root cause |
| `/plan-eng-review` | `vendors/gstack/plan-eng-review/SKILL.md` | B, E | After map, before implementing; locks in architecture, data flow, edge cases |
| `/review` | `vendors/gstack/review/SKILL.md` | D, G | Pre-landing gate, post-refactor check, final ship gate |
| `/greploop` | `custom/greploop/SKILL.md` | B, D, E, G | Dormant bounded review-fix-review loop; use automatically when concrete review findings should be fixed and re-reviewed until clean |
| `/codex` | `vendors/gstack/codex/SKILL.md` | D | Tier 2 review for auth/billing/prod-touching; adversarial challenge mode |
| `/ship` | `vendors/gstack/ship/SKILL.md` | G | Ship workflow: merge base, tests, diff review, bump VERSION, CHANGELOG, PR |
| `/careful` | `vendors/gstack/careful/SKILL.md` | B, G | Auto-activate for destructive ops / production code |
| `/learner` | `custom/learner/SKILL.md` | C, H | Extract hard-won debugging patterns and reusable templates |
| `/autoresearch` | `custom/autoresearch/SKILL.md` | B | When there's a measurable metric; iterate overnight autonomously |
| `/autoplan` | `vendors/gstack/autoplan/SKILL.md` | E | Large features with design docs; auto CEO + design + eng review |
| `/benchmark` | `vendors/gstack/benchmark/SKILL.md` | B | Performance-related IMPROVE; regression detection |
| `/retro` | `vendors/gstack/retro/SKILL.md` | A | Historical dimension of UNDERSTAND; git history, author breakdown |

---

## Natural Language Routing Table (39 rows)

| User says | Intent | Workflow | Primary tool(s) |
|-----------|--------|----------|----------------|
| "this code is spaghetti / a mess" | IMPROVE | B | graphify → plan-eng-review → execute → review |
| "clean this up" | IMPROVE | B | graphify → plan-eng-review |
| "refactor X into Y" | IMPROVE | B | graphify → plan-eng-review |
| "simplify this / too complex" | IMPROVE | B | graphify → plan-eng-review |
| "reduce coupling / decouple X from Y" | IMPROVE | B | graphify → plan-eng-review |
| "is there tech debt?" | IMPROVE | B | graphify (god nodes + surprising connections analysis) |
| "optimize this for performance" | IMPROVE | B | benchmark → graphify → refactor |
| "iterate on this overnight / improve automatically" | IMPROVE | B | autoresearch |
| "make this production-ready" | IMPROVE+REVIEW | B+D | graphify → careful → review |
| "map my codebase" | UNDERSTAND | A | graphify (full pipeline) |
| "explain my auth flow / data flow" | UNDERSTAND | A | graphify query |
| "what does this codebase do?" | UNDERSTAND | A | graphify (full pipeline) |
| "what are the main components?" | UNDERSTAND | A | graphify (god nodes) |
| "explain this module / what does X do?" | UNDERSTAND | A | graphify explain |
| "find the path from X to Y" | UNDERSTAND | A | graphify path |
| "what changed recently? / commit history" | UNDERSTAND | A | retro |
| "something is broken / bug / not working" | FIX | C | investigate |
| "this test is failing" | FIX | C | investigate |
| "why is X happening?" | FIX | C | investigate |
| "debug this" | FIX | C | investigate |
| "review my code / any issues?" | REVIEW | D | review (Tier 1) |
| "fix all review issues / loop until clean / make it pass review" | REVIEW+FIX | D | review → greploop |
| "is this SQL safe?" | REVIEW | D | review (Tier 1) |
| "second opinion / adversarial / be harsh" | REVIEW | D | codex (Tier 2) |
| "is this auth flow safe?" | REVIEW | D | review → codex |
| "check this PR / diff" | REVIEW | D | review |
| "add this feature / implement X" | BUILD | E | graphify query → plan-eng-review → build |
| "create boilerplate / scaffold X" | BUILD | E | graphify query (existing patterns) |
| "build a new endpoint for X" | BUILD | E | graphify → plan-eng-review |
| "large feature, here's my design doc" | BUILD | E | autoplan → plan-eng-review |
| "write tests for this / add tests" | BUILD | E | graphify query (test patterns) → generate |
| "this code has no tests, write them" | BUILD | E | graphify query (test patterns) → generate tests |
| "document this module / add docs" | DOCUMENT | F | graphify explain → generate |
| "add JSDoc / TSDoc / inline comments" | DOCUMENT | F | graphify explain → generate |
| "write a README for this module" | DOCUMENT | F | graphify (full) → explain → generate README |
| "ship this / create a PR" | SHIP | G | review → ship |
| "this is ready, push it" | SHIP | G | review → ship |
| "merge and deploy" | SHIP | G | careful → review → ship |
| "extract this pattern / make reusable" | TEMPLATE | H | graphify explain → learner |
| "create a template from this" | TEMPLATE | H | graphify explain → learner |

---

## AI-Agnostic & IDE-Agnostic Operation

This orchestrator is pure Markdown + natural language routing. Works identically on:
- **Claude Code** — `/code` or natural language (hook auto-triggers)
- **Codex CLI** — `/code`
- **Gemini CLI** — `/code` via `run_shell_command`
- **Cursor** — via `.cursor/rules.md` or command palette
- **Kiro IDE/CLI** — via `/code`
- **Antigravity** — via `/code`
- **All IDEs** — via skill symlink at `brain/ai/skills/active/code`

**Tool wrappers (CLI-based):**
- All sub-tools are CLI-based: `/graphify`, `/investigate`, `/review`, `/codex`, etc.
- No MCP servers, no IDE-specific plugins, no cloud services
- Storage: local `graphify-out/` directory (portable, inspectable, cacheable)

**Zero vendor lock-in:** All tools are plain bash/Python. All outputs (GRAPH_REPORT.md, graph.json, etc.) are standard formats. Backup is as simple as `tar -cz graphify-out/`.

---

## Underlying Tools Remain Independent

**Important:** The `/code` orchestrator is a **routing layer only**. It does NOT replace or constrain the underlying tools.

- Users can still invoke `/graphify`, `/investigate`, `/review`, etc. directly via CLI or skill
- Users can still call these tools directly: `graphify .`, `graphify query "..."`, `investigate`, etc.
- Each tool has its own documentation and remains fully independent
- The orchestrator is a convenience layer for users who prefer natural language routing

**Decision tree for users:**
- "I don't know which skill to use" → Use `/code` orchestrator (natural language routing)
- "I know exactly which skill I want" → Call it directly (skip the orchestrator)
- Both paths are equally valid and coexist.

---

## Reference

- **Graphify skill:** `brain/ai/skills/vendors/safishamsi/graphify/SKILL.md`
- **Investigate skill:** `brain/ai/skills/vendors/gstack/investigate/SKILL.md`
- **Learner skill:** `brain/ai/skills/custom/learner/SKILL.md`
- **Review skill:** `brain/ai/skills/vendors/gstack/review/SKILL.md`
- **GrepLoop skill:** `brain/ai/skills/custom/greploop/SKILL.md`
- **Plan-eng-review skill:** `brain/ai/skills/vendors/gstack/plan-eng-review/SKILL.md`
- **Ship skill:** `brain/ai/skills/vendors/gstack/ship/SKILL.md`
- **Careful skill:** `brain/ai/skills/vendors/gstack/careful/SKILL.md`
- **Codex skill:** `brain/ai/skills/vendors/gstack/codex/SKILL.md`
- **Autoresearch skill:** `brain/ai/skills/custom/autoresearch/SKILL.md`
- **Autoplan skill:** `brain/ai/skills/vendors/gstack/autoplan/SKILL.md`
- **Benchmark skill:** `brain/ai/skills/vendors/gstack/benchmark/SKILL.md`
- **Retro skill:** `brain/ai/skills/vendors/gstack/retro/SKILL.md`
- **Code-structure skill:** `brain/ai/skills/vendors/shimeles/code-structure/SKILL.md`

---

## Sub-Strategy: Service Layer Extraction (code-structure)

When the IMPROVE workflow detects duplicated operational logic across 2+ callers (identified via graphify analysis showing shared implementation patterns):

1. Activate the `code-structure` skill guidance
2. Follow its decision flowchart before extracting
3. Use its migration checklist for safe incremental extraction
4. Check against its anti-patterns before finalizing

**Activation signal:** Graphify shows 2+ files calling the same operational pattern (API calls, email sends, file operations, queue operations) with duplicated implementation.

**Do not activate for:** Single-use logic, trivial duplication (< 5 lines), or business rule differences that merely look similar.
