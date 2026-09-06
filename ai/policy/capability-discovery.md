# Capability Discovery Policy — AI-Agnostic

**Purpose:** Define how Brain discovers existing skills, CLIs, workflows, and config before adding new tools or relying on giant always-on capability lists.

**Status:** Canonical policy and routing contract for capability lookup across Claude Code, Codex CLI, Gemini CLI, and IDE/agent surfaces.

---

## Principle

Do not make the user know skill names, CLI names, MCP servers, or profile internals.

When the user asks for a capability in natural language, the AI system should
find the smallest existing capability that fits before suggesting installation,
activation, or new infrastructure. The shared implementation is:

```bash
node /Users/Office/Repos/stevewesthoek/brain/tools/discover-capabilities.mjs \
  --query "<the user's request>" --format compact
```

When already working from Brain, the relative form is preferred:
`node tools/discover-capabilities.mjs --query "<request>"`.

---

## Discovery Order

Use this order unless the user names an exact tool or file:

1. **Active/default skills** — start with the compact `capability-discovery` entry point.
2. **Shared discovery query** — scan the current skill, CLI, MCP, profile, and runbook registries.
3. **Selected source documentation** — read the best matching skill/runbook before acting.
4. **Actual availability** — verify the CLI through PATH or the MCP through its configured client surface; for CLI authentication/session readiness use the central redacted access-health checker. Presence is not authentication.
5. **Capability installation flow** — only after discovery shows no existing capability fits, use the universal capability installation process.

---

## Runtime Behavior

| Runtime/surface | Discovery behavior |
|---|---|
| Claude Code | Run the shared discovery query, read the selected source docs, then use Bash or an exposed MCP surface. |
| Codex CLI | Run the shared discovery query from Brain even when the custom skill is dormant; use shell or an exposed MCP surface. |
| Gemini CLI | Run the shared discovery query to find source docs and produce compact briefs; do not claim unsupported execution. |
| IDE/agent surfaces | Use the same query and registries; runtime-specific configuration only changes the available execution surface. |

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

Long inventories belong in the query-time discovery output and source registries
such as `docs/skills/skill-index.md`, `operations/CLI-MANIFEST.md`, and the MCP
admission/configuration sources.

---

## Output Contract

When choosing a capability, be explicit but compact:

```text
Capability route: <active skill | dormant skill source | CLI | runbook | policy>
Why: <one sentence>
Next action: <smallest safe step>
```

If no fitting capability is found, say what the shared query checked before proposing installation or new infrastructure.
