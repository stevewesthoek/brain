# Rule Onboarding and Hook Policy

**Purpose:** Keep Brain's operating rules modular, deterministic where possible, and out of always-on context unless they genuinely require orchestration judgment.

**Status:** Canonical rule-intake policy for Claude Code, Codex, Gemini, and shared Brain skills.

---

## Principle

Do not add new permanent rules directly to `CLAUDE.md`, `/code`, or other always-on prompts before classifying them.

Every new rule must be routed to the cheapest reliable enforcement surface:

1. **Hook** — deterministic rule that can be decided from tool input, file path, command text, staged files, or a small local check.
2. **Test/CI** — deterministic project invariant that belongs in normal validation.
3. **Skill** — repeatable workflow or CLI capability that should load only when relevant.
4. **Orchestrator rule** — judgment-based routing, task classification, architecture, review, or workflow selection.
5. **Runbook/documentation** — human-readable process that should not fire automatically.
6. **Memory** — user/project preference or learned pattern.

The default goal is to keep stable, deterministic safety and workflow rules out of the context window while preserving one standard way of working.

---

## Determinism Checklist

A rule is hook-eligible only when it passes all checks below.

| Check | Requirement |
|---|---|
| Observable | The trigger is visible from the hook input, command string, file path, staged diff, or a small local command. |
| Deterministic | The rule can decide `allow`, `warn`, `ask`, or `block` without broad repo reasoning or user-intent interpretation. |
| Cheap | The hook runs quickly and does not read large codebase context. |
| Stable | The rule is a long-lived invariant, not a one-off preference. |
| Low ambiguity | False positives are rare or safe because the hook asks instead of blocking. |
| Valuable | The hook prevents safety risk, expensive mistakes, token bloat, or repeated workflow failures. |

If a rule fails any of these checks, keep it in an orchestrator, skill, runbook, memory, or CI instead of making it a hook.

---

## Enforcement Levels

| Level | Meaning | Use when |
|---|---|---|
| `allow` | No interruption. | Rule does not apply. |
| `warn` | Surface a non-blocking warning. | The signal is useful but noisy or heuristic. |
| `ask` | Require confirmation before continuing. | The action is risky but may be legitimate. |
| `block` | Stop the action. | The action violates a hard invariant or would damage the repo/system. |

Prefer `ask` over `block` when a rule is newly introduced or has meaningful false-positive risk.

---

## Destination Matrix

| Rule type | Destination |
|---|---|
| Dangerous shell command | Hook |
| Secret/credential file edit | Hook |
| Generated/runtime file staging | Hook |
| Raw writes into `ai/skills/active` | Hook |
| Required preflight before deploy/publish/PR | Hook or CI |
| Project invariant with testable outcome | Test/CI |
| CLI workflow or repeatable tool use | Skill |
| Broad code reading or doc audit | Subagent / orchestrator delegation |
| Architecture choice | Orchestrator rule |
| Code quality judgment | Orchestrator rule or review skill |
| Review-fix-review iteration | `/code` routing to dormant `greploop` |
| User preference | Memory |
| Human process | Runbook/documentation |

---

## Current Hook Inventory

Claude hooks are configured through:

```text
operations/system-configs/claude/settings.json
```

Repo hook sources live in:

```text
operations/system-configs/claude/hooks/
```

Current known hook files:

```text
operations/system-configs/claude/hooks/auto-handoff.sh
operations/system-configs/claude/hooks/check-risky-command.sh
operations/system-configs/claude/hooks/check-sensitive-edit.sh
operations/system-configs/claude/hooks/inject-handoff.sh
operations/system-configs/claude/hooks/ledger-writer-hook.sh
```

Current deterministic coverage includes:

- confirmation for recursive deletes, force pushes, destructive git reset/checkout, deployments, and infrastructure mutations;
- confirmation for edits to credential-like files, `.env` files, and global AI configuration files;
- handoff injection/automation and ledger writing hooks.

---

## Initial Hook Candidate Backlog

These candidates were identified from `/code`, global Claude instructions, and current Brain repo state. They should be implemented incrementally, with tests/examples.

| Candidate | Source rule | Determinism | Recommended level | Notes |
|---|---|---:|---|---|
| `check-generated-stage.sh` | Avoid committing generated/runtime junk | High | `ask`/`block` | Detect `git add .`, broad staging, and staged `.next/`, `tsx-*`, SQLite runtime files, generated app bundles, job outputs. |
| `check-active-skill-surface.sh` | Never put raw skills directly in `active/` | High | `ask`/`block` | Protect active/dormant skill architecture. Dormant source skills belong in `custom/` or `vendors/`, then registry/docs decide exposure. |
| `check-review-before-ship.sh` | Review before PR/ship/deploy | Medium-high | `ask` | Require review evidence before `gh pr create`, `git push`, publish, deploy, or infra mutation. Start as confirmation, not hard block. |
| Extend `check-sensitive-edit.sh` | Protect secret-bearing material | High | `ask` | Add more credential/config path patterns as they are discovered. |
| Extend `check-risky-command.sh` | Ask before destructive commands | High | `ask` | Add missing destructive git, Docker, DB, and infra commands. |
| `check-truncated-code.sh` | Never output/write truncated code | Medium | `warn`/`ask` | Detect obvious placeholders such as `// ... rest of file`; may false-positive in docs/tests. |
| `check-memory-bulk-read.sh` | Use memory index, not bulk reads | Medium | `warn` | Detect broad reads over memory directories and suggest `mem-search`. |
| `check-dry-run-required.sh` | Preview before risky mutation | Medium | `ask` | Require plan/dry-run evidence for selected infra/data commands. |

---

## New Rule Intake Template

Use this template before adding a rule to prompts, skills, docs, hooks, or CI.

```md
## Rule

One sentence:

## Source / motivation

Why this rule exists:

## Trigger

- Tool name:
- Command pattern:
- File path:
- Staged diff:
- Output text:
- User intent:

## Determinism classification

- [ ] Deterministic
- [ ] Semi-deterministic
- [ ] Judgment-based

Reason:

## Destination

- [ ] Hook
- [ ] Test/CI
- [ ] Skill
- [ ] Orchestrator rule
- [ ] Runbook/documentation
- [ ] Memory

Reason:

## Enforcement level

- [ ] allow
- [ ] warn
- [ ] ask
- [ ] block

Reason:

## Evidence required

What proves the rule has been satisfied?

## False-positive risk

What legitimate work could this interrupt?

## Examples

Allowed examples:

Blocked/ask examples:

## Documentation updates

Files that must reference this rule:
```

---

## One Way of Working

1. New rules are classified with the intake template before becoming always-on instructions.
2. Deterministic rules move to hooks or CI when feasible.
3. Judgment rules stay in orchestrators or skills.
4. Repeatable CLI workflows become dormant skills unless they must be always active.
5. Broad reading is delegated to subagents/orchestrators instead of expanding the main context.
6. Documentation points to this policy instead of duplicating hook-selection logic.
7. Hook behavior starts conservative (`warn`/`ask`) and becomes stricter only after examples prove low false-positive risk.

---

## Relationship to `/code`

The Code Orchestrator owns judgment-based engineering decisions: intent classification, graphify/investigate/review/codex/greploop routing, architecture choices, scope discipline, and code-quality reasoning.

Hooks own deterministic safety and workflow gates: command/path/diff checks, generated-file staging prevention, sensitive edits, destructive command confirmation, and pre-ship evidence checks.

Do not move `/code` routing laws into hooks unless the rule can be evaluated from a concrete observable signal without semantic reasoning.
