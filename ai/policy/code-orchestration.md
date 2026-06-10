# Code Orchestration Policy — AI-Agnostic

**Purpose:** Define how Brain routes coding work across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces without requiring the user to know skill names or runtime internals.

**Status:** Canonical policy for `/code` orchestration and code-work routing. Tool-specific configs should reference this file instead of duplicating routing rules.

---

## Principle

The user describes the coding outcome in natural language. The AI system chooses the smallest reliable workflow, runtime, and supporting skills.

`/code` is the default conceptual entry point for coding work, but the policy is runtime-agnostic: Claude, Codex, Gemini, Cursor, Kiro, Antigravity, and other IDE/agent surfaces should preserve the same routing behavior when they are the entry point.

---

## Runtime Roles

| Runtime/surface | Default role | Use for |
|---|---|---|
| Claude Code | Primary orchestrator | Repo-wide reasoning, multi-step implementation, architecture, memory-aware work, iterative review/fix loops |
| Codex CLI | Parallel executor / reviewer | Isolated tasks, code review, second opinions, patch checks, focused implementation with clear scope |
| Gemini CLI / Gemini Flash | Large-context preprocessor | Bulk ingestion, summarizing very large files/logs/docs, extracting candidate context before implementation |
| IDE/agent surfaces | Operating surface | Editing, local execution, visual workflows, task-specific workbench use; should still follow Brain routing/policy |

When a non-Claude runtime is the entry point, it should apply this policy directly and escalate or hand off only when the task exceeds its reliable scope.

---

## Intent Routing

| User intent | Default workflow | Notes |
|---|---|---|
| Understand code | Map/query code structure before answering | Use graph/code search first; summarize in plain language. |
| Improve/refactor | Map before touching, then plan, then edit | Do not refactor blind. Preserve scope. |
| Fix bug | Reproduce or localize first, then patch smallest root cause | Save non-obvious recurring fixes through the learning workflow when appropriate. |
| Review | Review diff/code before implementation or shipping | Use review findings as evidence, not as automatic permission to rewrite broadly. |
| Build feature | Classify scope, plan multi-file changes, reuse existing patterns | Avoid inventing new architecture when existing patterns exist. |
| Document | Read source first, document what exists, avoid speculative docs | Keep generated docs tied to code evidence. |
| Ship | Review before PR/publish/deploy, then ship workflow | Deterministic shipping/destructive checks may be enforced by hooks or CI. |
| Template/extract | Identify reusable structure, parameterize specifics, document pattern | Promote to a skill only if it passes the quality gate. |

---

## Subskill Routing

The user should not need to know subskill names. Use dormant subskills from `docs/skills/skill-index.md` and `docs/skills/profiles/` when the task calls for them.

Common routes:

| Need | Route |
|---|---|
| Codebase map, dependency understanding, refactor safety | `graphify` |
| Root-cause investigation | `investigate` |
| Review before ship or safety check | `review` |
| Validation/test strategy | `qa` |
| High-risk production/destructive change | `careful` |
| Bounded review-fix-review loop | dormant `greploop`, only when review findings are concrete, fixable, and in scope |
| Large feature plan | `autoplan` or `plan-eng-review` |
| Durable non-obvious fix pattern | `learner` / learned skill workflow |
| Shipping/PR/release flow | `ship` |

Dormant means not default-active, not unavailable. Locate dormant skills through the registry and source docs rather than forcing users to activate or name them.

---

## Autonomous Progress Rules

The system should proceed without asking when the next step is local, reversible, and clearly inside the requested scope:

- read/search/analyze repo files;
- inspect diffs, logs, tests, and local config;
- make focused edits in intended files;
- run local validation that does not mutate production/shared state;
- use dormant source docs to choose a workflow;
- summarize findings and continue to the next obvious safe step.

The system should stop or ask when:

- user intent or target scope is ambiguous and the next action would be costly or destructive;
- the action mutates production/shared state, credentials, billing, DNS, public content, or customer data;
- review findings are contradictory, architectural, or outside requested scope;
- validation fails repeatedly after a repair attempt;
- proceeding would require activating a default skill/profile or installing a capability;
- the runtime cannot reliably hold the needed context.

---

## Review-Fix-Review Loop

Use a bounded loop only when all are true:

1. There is a review gate or explicit user request to fix review findings.
2. Findings are concrete, actionable, and within the requested scope.
3. The likely fix is local and testable.
4. The loop has a clear stop condition: clean review, max iterations, unresolved risk, or user intervention needed.

Do not loop for:

- architecture-level redesign;
- vague quality complaints without concrete findings;
- non-code reviews;
- contradictory or subjective review findings;
- broad refactors not requested by the user.

---

## AI-Agnostic Safety Layer

Prefer deterministic enforcement outside prompts when feasible:

- Claude Code may use hooks in `operations/system-configs/claude/hooks/`.
- Codex/Gemini/CI should use equivalent scripts, checks, or documented manual gates when hooks are not available.
- Canonical rule classification lives in `docs/rules/rule-onboarding-and-hook-policy.md`.
- Hook candidates and behavior examples live in `docs/rules/hook-candidate-registry.md` and `operations/system-configs/claude/hooks/tests/README.md`.

Prompt rules should keep judgment and routing. Hooks/tests/CI should carry deterministic command/path/diff checks.

---

## Output Contract

For coding work, produce outputs that are:

- scoped to the user request;
- grounded in files, diffs, tests, or source evidence;
- explicit about what changed and what was validated;
- clear about remaining risk or unresolved work;
- free of truncated code placeholders in deliverables.

Prefer compact progress updates and concrete next actions over long explanations of internal routing.
