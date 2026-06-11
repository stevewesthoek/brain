# Handoff Brief Templates

**Purpose:** Copy/paste-ready brief formats for AI-agnostic handoffs between Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

**Canonical policy:** `ai/policy/handoff-and-parallel-briefs.md`

Use these templates only when they reduce context load, risk, or duplicated reading. Do not add process to simple tasks.

---

## 1. Resume Handoff

Use when work is interrupted or should continue in another runtime/surface.

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

---

## 2. Gemini Large-Context Preprocessing Brief

Use when Gemini should ingest bulky source material and return a compact briefing.

```text
Task: Read the sources below and produce a compact implementation/review briefing.
Goal: <what the downstream runtime needs to do>
Scope: <what to include / exclude>
Sources: <paths, folders, logs, docs, or pasted bundle>
Focus questions:
1. <question>
2. <question>
Output needed:
- relevant files/sections;
- key findings with evidence;
- risks or contradictions;
- minimal context the next runtime needs;
- recommended next action.
Do not rewrite code. Do not invent missing facts.
```

---

## 3. Codex Focused Review Brief

Use when Codex should review a bounded diff, file set, or isolated implementation detail.

```text
Task: Review this bounded change for concrete issues.
Goal: <what the change is supposed to achieve>
Scope: <files/diff/logic to review>
Out of scope: <architecture/product/style-only churn>
Evidence to inspect: <paths, diff, tests, logs>
Check for:
- correctness;
- edge cases;
- security/trust boundaries;
- tests/validation gaps;
- obvious simplifications.
Output format:
- Blocking findings;
- Non-blocking findings;
- Evidence paths/lines;
- Suggested smallest fix.
Do not broaden the task or rewrite unrelated code.
```

---

## 4. Parallel Reader Brief

Use when multiple readers can inspect independent sources safely before synthesis.

```text
Shared goal: <overall question or decision>
Reader assignment: <specific files/sources for this reader only>
Scope boundary: <what not to inspect or change>
Return:
- relevant evidence with paths/sections;
- local findings;
- confidence level;
- unresolved questions;
- whether another source must be checked.
Do not edit files. Do not create a global plan. Produce evidence for synthesis.
```

---

## 5. Ship/Readiness Brief

Use before PR creation, publish, deploy, or another shipping action.

```text
Goal: <what is being shipped>
Changes: <files/commits/features/fixes>
Review evidence: <review command, reviewer, or finding summary>
Validation evidence: <tests/checks and results>
Risk areas: <auth, data, infra, migrations, credentials, generated artifacts>
Known non-blockers: <accepted issues, if any>
Blocking issues: <must be empty before shipping>
Next action: <PR/push/deploy command or handoff target>
```

---

## 6. Blocked Handoff

Use when the current runtime should stop.

```text
Goal: <user outcome>
Blocked because: <specific blocker>
Evidence: <what proves the blocker>
Tried: <actions already taken>
Safe state: <what changed / what did not change>
Needed from user or next runtime: <one exact decision/action>
Do not continue until: <clear unblock condition>
```
