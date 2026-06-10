# Capability Discovery Policy — AI-Agnostic

**Purpose:** Define how Brain discovers existing skills, CLIs, workflows, and config before adding new tools or relying on giant always-on capability lists.

**Status:** Canonical policy for capability lookup across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

---

## Principle

Do not make the user know skill names, CLI names, MCP servers, or profile internals.

When the user asks for a capability in natural language, the AI system should find the smallest existing capability that fits before suggesting installation, activation, or new infrastructure.

---

## Discovery Order

Use this order unless the user names an exact tool or file:

1. **Active/default skills** — use the current exported skill surface for common work.
2. **Skill index** — check `docs/skills/skill-index.md` for dormant skills and profiles.
3. **Domain profiles** — check `docs/skills/profiles/` when a domain is obvious, such as design, video, research, deploy, productivity, or power-user work.
4. **CLI manifest** — check `operations/CLI-MANIFEST.md` for installed shell tools and verification commands.
5. **AI config index** — check `operations/AI-CONFIG-INDEX.md` for global config, hooks, policies, model routing, and runtime-specific files.
6. **Runbooks and policy docs** — check `operations/runbooks/`, `ai/policy/`, and `docs/rules/` when the task is operational or procedural.
7. **Capability installation flow** — only after registry search shows no existing capability fits, use the universal capability installation process.

---

## Runtime Behavior

| Runtime/surface | Discovery behavior |
|---|---|
| Claude Code | Use active skills first; consult registries for dormant skills, CLIs, hooks, and runbooks instead of relying on long inline lists. |
| Codex CLI | Use this policy directly when Codex is the entry point; do not assume a skill is unavailable because it is not in Codex's minimal root. |
| Gemini CLI | Use this policy to find source docs and produce compact briefs; avoid pretending Gemini should execute workflows that belong to Claude/Codex. |
| IDE/agent surfaces | Treat skills, CLIs, and runbooks as Brain-owned capabilities; use registries rather than local memory or duplicated lists. |

---

## Installation Rule

Before installing any new skill, CLI, MCP server, plugin, or agent surface:

1. Search the skill index for an existing skill or dormant source.
2. Search the CLI manifest for an installed command.
3. Search the AI config index for an existing config, hook, policy, or runbook.
4. If a capability exists, use or document that route instead of installing another one.
5. If no capability exists, follow the universal capability installation workflow and update every affected registry/config together.

Never install a capability into only one runtime when the capability should be shared.

---

## Prompt Bloat Rule

Tool-specific prompts should not carry exhaustive skill or CLI inventories.

Keep always-on prompts limited to:

- canonical policy references;
- active/default entry points;
- high-risk guardrails that cannot yet be enforced elsewhere;
- where to look up dormant capabilities.

Long inventories belong in registries such as `docs/skills/skill-index.md` and `operations/CLI-MANIFEST.md`.

---

## Output Contract

When choosing a capability, be explicit but compact:

```text
Capability route: <active skill | dormant skill source | CLI | runbook | policy>
Why: <one sentence>
Next action: <smallest safe step>
```

If no fitting capability is found, say what was checked before proposing installation or new infrastructure.
