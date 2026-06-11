# Context Loading Order Policy — AI-Agnostic

**Purpose:** Define the shared order for loading Brain policies, skills, registries, runbooks, and task context across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

**Status:** Canonical policy for prompt/context ordering. Runtime-specific configs should reference this file instead of duplicating long policy lists.

---

## Principle

Load the least context needed in the safest useful order.

Always-on prompts should point to canonical policies and registries, not copy their contents. Task-specific context should be loaded only when it affects the next safe decision.

---

## Default Loading Order

Use this order unless a runtime has a stricter built-in startup sequence:

1. **Guardrails / safety** — `ai/policy/guardrails.md`
2. **Routing / runtime role** — `ai/policy/routing.md`
3. **Task-specific orchestration** — for coding work, `ai/policy/code-orchestration.md`; for other domains, use the relevant skill or runbook.
4. **Capability discovery** — `ai/policy/capability-discovery.md`
5. **Handoff / parallel briefs** — `ai/policy/handoff-and-parallel-briefs.md`
6. **Rule onboarding / deterministic gates** — `docs/rules/rule-onboarding-and-hook-policy.md` and `docs/rules/hook-candidate-registry.md`
7. **Active/default skill surface** — `docs/skills/profiles/default.txt` and `ai/skills/active/`
8. **Dormant registries and domain profiles** — `docs/skills/skill-index.md`, `docs/skills/profiles/`, `operations/CLI-MANIFEST.md`, `operations/runbooks/`, and `operations/AI-CONFIG-INDEX.md` only when needed.
9. **Repo/task-specific evidence** — exact files, diffs, logs, tests, docs, and user-provided context needed for the current task.

---

## Runtime Notes

| Runtime/surface | Loading behavior |
|---|---|
| Claude Code | May have richer always-on startup context, but should keep canonical policy references ordered and avoid expanding inline inventories. |
| Codex CLI | Should use the same policy order when Codex is the entry point, then hand off when the task exceeds focused review/execution scope. |
| Gemini CLI | Should use the same policy order before producing large-context preprocessing briefs; do not load execution workflows unless needed. |
| IDE/agent surfaces | Should treat this order as the Brain-owned context contract and load source docs by pointer when available. |

---

## Prompt Bloat Rule

Do not make runtime configs longer just to restate this order.

Preferred pattern:

```text
Context loading order canonical source: `brain/ai/policy/context-loading-order.md`.
```

Then keep only the short references that the runtime needs at startup.

---

## When to Deviate

Deviate from the default order only when:

- the user names an exact file, tool, policy, or command;
- a safety issue is already obvious and guardrails must be applied first;
- a runtime has already loaded a relevant canonical policy;
- a task is non-coding and a domain-specific skill/runbook is clearly the smallest route;
- a handoff brief already contains sufficient validated context.

When deviating, preserve the principle: smallest safe context before broad context.

---

## Output Contract

When reporting context decisions, keep it compact:

```text
Loaded: <policies/files actually used>
Skipped: <large registries or dormant docs not needed>
Next: <exact next context or action>
```
