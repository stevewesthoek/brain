# Anthropic-Inspired AI System Checkpoint — Steps 1–5

**Purpose:** Compact checkpoint for the Brain system changes inspired by the principle: stop growing prompts; build systems that route, discover, enforce, and hand off through documented policies and deterministic gates.

**Status:** Implementation checkpoint for completed Steps 1–5.

---

## Completed Steps

### Step 1 — Move deterministic rules out of always-on context

**Outcome:** New permanent rules now have a classification path before entering prompts. Deterministic command/path/diff rules are routed toward hooks or CI instead of expanding always-on instructions.

**Primary docs:**

- `docs/rules/rule-onboarding-and-hook-policy.md`
- `docs/rules/hook-candidate-registry.md`
- `operations/system-configs/claude/hooks/tests/README.md`

**Implemented hook candidates:**

- generated/runtime artifact staging guard;
- active skill surface guard;
- review-before-ship guard;
- expanded sensitive edit guard;
- expanded risky command guard.

---

### Step 2 — Make `/code` self-orchestrating and AI-agnostic

**Outcome:** Coding work now has a canonical routing/orchestration contract that applies across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

**Primary docs:**

- `ai/policy/code-orchestration.md`
- `ai/skills/custom/code/SKILL.md`
- `operations/system-configs/codex/AGENTS.md`
- `operations/system-configs/gemini/GEMINI.md`

**Key behavior:**

- natural-language coding requests route through `/code` conceptually;
- runtime roles are explicit;
- review/fix/review loops are bounded;
- dormant skills are discoverable without making them default-active.

---

### Step 3 — Make capability discovery registry-driven

**Outcome:** Skills, dormant profiles, CLIs, runbooks, and config sources are discovered through registries instead of giant inline lists or one-runtime-only assumptions.

**Primary docs:**

- `ai/policy/capability-discovery.md`
- `docs/skills/skill-index.md`
- `docs/skills/profiles/`
- `operations/CLI-MANIFEST.md`
- `operations/AI-CONFIG-INDEX.md`

**Key behavior:**

- discover before install;
- active skills first, dormant registries second;
- exhaustive capability lists stay out of runtime prompts;
- Claude, Codex, and Gemini share the same discovery contract.

---

### Step 4 — Add AI-agnostic handoff and parallel-reader patterns

**Outcome:** Cross-runtime work now moves through compact evidence briefs instead of whole conversations or bloated context dumps.

**Primary docs:**

- `ai/policy/handoff-and-parallel-briefs.md`
- `operations/runbooks/handoff-brief-templates.md`
- `operations/runbooks/README.md`

**Key behavior:**

- standard handoff brief shape;
- Gemini large-context preprocessing brief;
- Codex focused review brief;
- parallel-reader brief;
- ship/readiness brief;
- blocked-work handoff.

---

### Step 5 — Stabilize prompt/context ordering and activation strategy

**Outcome:** Brain now has one canonical load order for policies, registries, skills, and task evidence.

**Primary docs:**

- `ai/policy/context-loading-order.md`
- `operations/system-configs/claude/CLAUDE.md`
- `operations/system-configs/codex/AGENTS.md`
- `operations/system-configs/gemini/GEMINI.md`
- `docs/skills/profiles/default.txt`

**Default active skill surface:**

```text
code
research
memory
review
qa
handoff
careful
```

**Dormant by design:**

- `ai/skills/custom/greploop/SKILL.md`
- no `ai/skills/active/greploop/SKILL.md`

---

## Current Canonical Policy Stack

Load the smallest needed context in this order:

1. `ai/policy/guardrails.md`
2. `ai/policy/routing.md`
3. task-specific orchestration, especially `ai/policy/code-orchestration.md` for coding work
4. `ai/policy/capability-discovery.md`
5. `ai/policy/handoff-and-parallel-briefs.md`
6. `docs/rules/rule-onboarding-and-hook-policy.md`
7. `docs/skills/profiles/default.txt` and `ai/skills/active/`
8. dormant registries and runbooks only when needed
9. exact repo/task evidence

Canonical source: `ai/policy/context-loading-order.md`.

---

## Guardrails Preserved

- Do not activate GrepLoop by default.
- Do not expand always-on prompts with giant capability lists.
- Do not install new tools before registry discovery.
- Do not add new permanent rules before classification.
- Prefer hooks/CI for deterministic checks.
- Prefer compact handoff briefs over conversation dumps.
- Keep `/code` judgment-based; keep deterministic command/path gates in hooks where possible.

---

## Validation Notes

Recent verification confirmed:

- Claude, Codex, and Gemini reference `ai/policy/context-loading-order.md`.
- Claude settings JSON validates.
- default profile remains the seven-skill surface.
- `research` and `review` active skill paths resolve.
- GrepLoop remains dormant.

Known unrelated local/runtime/generated dirty files may appear during validation and should not be committed unless intentionally handled:

```text
.graphifyignore
operations/system-configs/claude/.last-cleanup
operations/system-configs/claude/.last-update-result.json
operations/system-configs/claude/settings.json
projects/brain-console/tsconfig.tsbuildinfo
```
