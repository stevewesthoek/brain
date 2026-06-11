# Handoff and Parallel Briefs Policy — AI-Agnostic

**Purpose:** Define how Brain passes work between Claude Code, Codex CLI, Gemini CLI, and other agent/IDE surfaces without dumping excessive context or relying on runtime-specific memory.

**Status:** Canonical policy for cross-runtime handoffs, large-context preprocessing briefs, parallel review briefs, and stop/resume summaries.

---

## Principle

Do not move the whole conversation when a compact task brief will do.

Every handoff should preserve the decision-relevant state:

- goal;
- scope;
- files or sources already inspected;
- evidence found;
- decisions made;
- constraints and safety boundaries;
- validation/review status;
- exact next action.

The receiving runtime should be able to continue safely without guessing, rereading everything, or depending on hidden chat memory.

---

## When to Handoff

Use a handoff or parallel brief when:

| Signal | Brief type | Default receiver |
|---|---|---|
| Context is too large for the current runtime | Large-context preprocessing brief | Gemini |
| A second opinion or isolated review is useful | Review brief | Codex or `/review` |
| Work should continue in another surface | Resume handoff | Claude Code, Codex, Gemini, or IDE/agent surface |
| A task is interrupted or stopped | Stop/resume summary | Same or next runtime |
| Multiple readers can inspect independent files safely | Parallel-reader brief | Codex/Gemini/Claude subtask reader |
| Shipping needs evidence consolidation | Ship/readiness brief | Claude Code plus review/ship workflow |

Do not hand off merely to create process. Use it only when it reduces context load, risk, or duplicated reading.

---

## Standard Brief Shape

Use this compact structure unless a specific skill/runbook requires another format.

Copy/paste templates live at `operations/runbooks/handoff-brief-templates.md`.

Use this compact structure:

```text
Goal: <user outcome>
Scope: <in scope / out of scope>
Current state: <done, in progress, blocked>
Files/sources inspected: <paths, docs, URLs, commits, logs>
Findings: <evidence, not guesses>
Decisions made: <constraints, chosen approach, rejected routes>
Changed files: <if any>
Validation/review: <commands, checks, results, or not run + why>
Risks/open questions: <only actionable unknowns>
Next action: <one exact next step>
```

Keep the brief short enough to paste into another runtime without compaction. Prefer pointers to files/commits over copied content.

---

## Parallel Reader Contract

When splitting reading across runtimes or agents:

1. Assign each reader a bounded file/source set.
2. Give each reader the same goal and scope boundary.
3. Ask for evidence-first output: paths, lines/sections, findings, and confidence.
4. Forbid broad rewrites unless explicitly requested.
5. Recombine findings before editing.
6. Treat disagreements as review input, not automatic blockers.

Parallel readers should produce briefs, not autonomous sprawling plans.

---

## Runtime Roles

| Runtime/surface | Handoff role |
|---|---|
| Claude Code | Primary orchestrator; receives consolidated briefs; makes architecture/scope decisions; owns iterative implementation when appropriate. |
| Codex CLI | Focused reviewer/executor; receives bounded diffs, files, tests, or isolated tasks; returns concise findings or patches. |
| Gemini CLI | Large-context preprocessor; ingests bulky docs/logs/repos and returns compact briefings for Claude/Codex. |
| IDE/agent surfaces | Execution surface; receives exact next actions and file references; returns changed files, validation, and blockers. |

When a non-Claude runtime is the entry point, it may produce the first brief and hand off when the task exceeds its reliable scope.

---

## Anti-Bloat Rules

- Do not paste entire files into a handoff when paths and line ranges are enough.
- Do not include stale plans that were superseded.
- Do not include unrelated repo status noise unless it affects the next action.
- Do not summarize generated/runtime artifacts unless they are the task target.
- Do not convert every simple task into a multi-runtime workflow.

---

## Stop Conditions

Stop and produce a handoff when:

- validation fails twice after a repair attempt;
- review findings are contradictory, subjective, or out of scope;
- the next action touches production, credentials, infrastructure, or destructive commands and blast radius is unclear;
- the current runtime lacks context, tool access, or safe execution budget;
- the user explicitly asks to stop or switch surfaces.

---

## Output Contract

For user-facing work, end with:

```text
Completed: <what changed or was learned>
Evidence: <files/commands/review sources>
Validation: <result or not run + why>
Next: <exact next action or handoff target>
```

For runtime-to-runtime work, use the standard brief shape above.
