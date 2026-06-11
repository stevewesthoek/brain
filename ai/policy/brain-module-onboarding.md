# Brain Module Onboarding Policy — AI-Agnostic

**Purpose:** Define one standard way to add, change, activate, or retire any Brain module without creating drift, prompt bloat, runtime lock-in, or undocumented workflows.

**Status:** Canonical onboarding policy for Brain modules across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

---

## Principle

Nothing important should be added to Brain in a one-off way.

Every new module must be classified, routed, documented, indexed, and validated through the smallest reliable surface before it becomes part of the operating system.

Prefer modular references over duplicated instructions. Prefer registries over always-on lists. Prefer deterministic hooks or tests over prompt rules. Prefer profiles over default activation.

---

## What Counts as a Module

A Brain module is any reusable part of the AI operating system, including:

| Module type | Examples |
|---|---|
| Skill | active skill, dormant skill, vendor skill, profile-scoped skill |
| Profile | default, research, design, video, deploy, productivity, power |
| Hook | PreToolUse, PostToolUse, UserPromptSubmit, stage/command/path guard |
| Rule | safety rule, workflow rule, prompt rule, review rule, routing rule |
| Policy | canonical AI-agnostic behavior contract in `ai/policy/` |
| Runbook | human-readable procedure in `operations/runbooks/` |
| CLI/tool | installed command, wrapper script, custom utility, MCP alternative |
| Runtime/model surface | Claude Code, Codex CLI, Gemini CLI, IDE/agent surface, future LLM runtime |
| Config integration | global config, symlink, template, model routing, environment-specific file |
| Automation | scheduler, sync script, generated artifact, repo maintenance job |
| Memory/knowledge route | durable preference, decision log entry, mind-vs-brain routing rule |

---

## Required Onboarding Flow

Use this flow before adding or changing any module.

### 1. Classify

Identify the module type and the smallest owner surface.

```text
Module type: <skill | profile | hook | rule | policy | runbook | CLI/tool | runtime/model | config | automation | memory>
Owner surface: <ai/policy | docs/rules | ai/skills | docs/skills/profiles | operations/runbooks | operations/system-configs | tools | mind>
Runtime scope: <all runtimes | Claude only | Codex only | Gemini only | local repo only | external>
```

### 2. Discover first

Before creating anything new, check existing registries in this order:

1. `ai/policy/capability-discovery.md`
2. `00-memory-map.md`
3. `operations/AI-CONFIG-INDEX.md`
4. `docs/skills/skill-index.md`
5. `docs/skills/profiles/`
6. `operations/CLI-MANIFEST.md`
7. `operations/runbooks/`
8. `docs/rules/`
9. `operations/decision-log.md`

If an existing module fits, extend or document that module instead of creating a duplicate.

### 3. Decide activation level

Do not make new modules default-active by habit.

| Activation level | Use when |
|---|---|
| Default active | The capability is broadly useful in ordinary work and worth always-on context. Requires strong justification. |
| Profile-scoped | The capability is useful for a domain such as research, design, video, deploy, or productivity. Preferred for most skills. |
| Dormant/discoverable | The capability should exist but load only when needed. Preferred default for specialized modules. |
| Hook/test enforced | The behavior is deterministic and should run outside the context window. |
| Runbook-only | The process is human-readable or rare and should not run automatically. |
| External/manual | The dependency is outside Brain and must be documented as such. |

### 4. Route deterministic behavior out of prompts

For every proposed rule or workflow, apply `docs/rules/rule-onboarding-and-hook-policy.md`.

Ask:

- Can this be observed from command text, file path, staged diff, tool input, or a small local check?
- Is it deterministic enough for `allow`, `warn`, `ask`, or `block`?
- Should it be a hook, CI/test, skill, orchestrator rule, runbook, or memory?

Do not add deterministic rules directly to always-on prompts unless no reliable lower-cost surface exists.

### 5. Document source and registry entries together

A module is not onboarded until its source and lookup path are both clear.

| Module type | Required docs/registries |
|---|---|
| Skill | `ai/skills/...`, `docs/skills/skill-index.md`, relevant `docs/skills/profiles/*.txt`, possibly `ai/policy/capability-discovery.md` |
| Profile | `docs/skills/profiles/*.txt`, `docs/skills/skill-index.md`, profile switching/sync docs if affected |
| Hook | hook source, `operations/system-configs/claude/settings.json`, `docs/rules/hook-candidate-registry.md`, `docs/rules/rule-onboarding-and-hook-policy.md` if behavior changes |
| Rule | `docs/rules/rule-onboarding-and-hook-policy.md`, destination doc/hook/test/skill/runbook/memory |
| Policy | `ai/policy/*.md`, `operations/AI-CONFIG-INDEX.md`, runtime references only when needed |
| Runbook | `operations/runbooks/*.md`, `operations/runbooks/README.md`, `00-memory-map.md` or `operations/AI-CONFIG-INDEX.md` if broadly discoverable |
| CLI/tool | `operations/CLI-MANIFEST.md`, tool source or install notes, relevant skill/runbook if used by AI workflows |
| Runtime/model | `operations/system-configs/<runtime>/`, `operations/AI-CONFIG-INDEX.md`, `ai/policy/context-loading-order.md`, `ai/policy/capability-discovery.md`, and any symlink/config notes |
| Config integration | owning `operations/system-configs/` folder, template if secrets are involved, `operations/AI-CONFIG-INDEX.md` |
| Automation | script/source, scheduler/config docs, generated-file policy, validation/runbook if recurring |
| Memory route | `00-current-context.md`, `00-memory-map.md`, `operations/decision-log.md`, or `mind` depending on durability and privacy |

### 6. Keep runtime and environment boundaries explicit

Brain should remain AI-agnostic and environment-aware.

When adding a runtime/model/config integration, document:

- what is shared across all AI surfaces;
- what is runtime-specific;
- what is local-machine state;
- what is secret or not symlinked;
- what is generated and should not be edited directly;
- what breaks if the runtime is absent;
- the fallback or handoff path.

Never silently install or document a capability as Claude-only, Codex-only, or Gemini-only if it should be shared through Brain.

### 7. Validate the smallest useful invariant

Use the smallest meaningful validation.

| Change | Validation |
|---|---|
| Docs only | focused diff/readback; no heavy test needed |
| JSON/config | JSON validation or runtime config check |
| Hook | behavior example, dry-run, or small fixture test |
| Skill/profile | profile list/symlink check; default surface unchanged unless intended |
| CLI/tool | manifest verification command or help/version check |
| Runtime/model config | config syntax/readback; secret boundary check |
| Code/automation | targeted test/typecheck/lint when available |

### 8. Record decisions only when durable

Use `operations/decision-log.md` for durable architecture decisions, not every small edit.

Record a decision when a module changes:

- default active surface;
- shared runtime behavior;
- security/safety posture;
- routing architecture;
- dependency boundaries;
- generated/runtime file policy;
- ownership of a major workflow.

---

## Module Onboarding Checklist

Before committing a module change, answer:

```text
1. What module type is this?
2. Did I check existing registries first?
3. Is this default-active, profile-scoped, dormant, hook/test-enforced, runbook-only, or external/manual?
4. Is any deterministic behavior moved out of prompts where feasible?
5. Which source file owns the behavior?
6. Which registry/index makes it discoverable?
7. Which profiles, hooks, configs, or symlinks are affected?
8. Are runtime-specific and shared parts clearly separated?
9. Are secrets, generated files, and local machine state protected?
10. What is the smallest useful validation?
11. Does this require a decision-log entry?
12. Does this preserve the current context-loading order and capability discovery flow?
```

---

## Anti-Drift Rules

- Do not add giant capability lists to runtime prompts.
- Do not activate a skill by editing `ai/skills/active` directly; use profiles/sync flow unless explicitly approved.
- Do not create a new CLI wrapper before checking `operations/CLI-MANIFEST.md`.
- Do not add a new hook without a documented trigger, enforcement level, and source path.
- Do not add a new runtime/model integration without documenting shared vs runtime-specific behavior.
- Do not duplicate a policy in Claude, Codex, Gemini, and IDE prompts; reference the canonical file.
- Do not make generated/runtime files part of the stable source contract unless intentionally promoted.
- Do not store personal knowledge in Brain when it belongs in `mind`.

---

## Output Contract

When proposing or implementing a module change, summarize:

```text
Module type:
Owner surface:
Activation level:
Registries updated:
Runtime scope:
Validation:
Decision log needed: yes/no
```

If any field is unknown, stop and inspect the relevant registry before expanding the system.
