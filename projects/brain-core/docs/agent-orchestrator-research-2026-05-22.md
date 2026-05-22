# Agent Orchestrator Research Synthesis

**Date:** 2026-05-22
**Status:** Strategy input
**NotebookLM notebook:** `19d3e65e-eb6b-48cb-924b-3d152ba2fd50` - Agent Orchestration Research 2026-05-22
**Related docs:** `video-orchestrator-strategy.md`, `video-orchestrator-roadmap.md`, `video-orchestrator-implementation-plan.md`, `ai-model-selector-architecture.md`

## Research Question

How should Brain add agent-mode orchestration that can build and launch full projects using Steve's local M4/M1 Ollama capacity, Codex CLI subscription capacity, Amazon Bedrock Claude fallback, existing orchestration skills, and infrastructure CLIs?

## Primary Sources Reviewed

| Source | Relevant pattern |
|--------|------------------|
| Mercury Agent | Permission-hardened tools, progressive skill loading, persistent memory, scheduler, sub-agents, resource manager, file locks, task board. |
| agentmemory | Shared memory server across Claude, Codex, Gemini, MCP, and REST; automatic capture; hybrid retrieval; replayable sessions. |
| Gas Town | Multi-agent workspace manager with persistent work tracking, coordinator role, worker agents, git-backed state, mailboxes, escalation, merge queue, scheduler. |
| OpenHuman | Local-first memory tree, typed integrations, model routing, token compression, on-device knowledge storage. |
| Hermes Agent | Skills standard, self-improving procedural memory, multi-channel gateway, scheduled automations, isolated subagents, multiple terminal backends. |
| Brain existing Agentic OS docs | Brain Core owns agent state; skills are capabilities; external CLIs are executors; approval-gated writes only. |

Source URLs:
- https://github.com/cosmicstack-labs/mercury-agent
- https://github.com/rohitg00/agentmemory
- https://github.com/gastownhall/gastown
- https://github.com/tinyhumansai/openhuman
- https://github.com/NousResearch/hermes-agent
- `docs/system/agentic-os-external-repo-review-2026-05-17.md`
- `docs/system/unified-orchestrator-command-center-implementation-plan-2026-05-17.md`

## Recommendation

Build a Brain-native Agent Orchestrator as a separate layer above the AI Model Selector.

The AI Model Selector remains narrow: it answers "which AI execution surface should handle this task?" It should not own project plans, task decomposition, repo state, CLI access, approvals, or memory. The Agent Orchestrator owns those higher-level concerns and calls the selector whenever a task needs LLM execution.

Recommended stack:

1. **Brain Core Agent Orchestrator**
   - Owns persistent run records, event logs, task graph, approvals, capability registry, and handoffs.
   - Exposes read-only status and approval surfaces to Brain Console.
   - Does not execute dangerous operations without explicit approval.

2. **AI Model Selector**
   - Resource allocator for AI work.
   - Provider order is fixed by policy: local Ollama M4/M1 first, Codex CLI second, Amazon Bedrock Claude third.
   - No direct OpenAI API and no direct Anthropic API providers.

3. **Execution Adapters**
   - Local Ollama through OpenAI-compatible HTTP.
   - Codex CLI for subscription-backed OpenAI model use.
   - Amazon Bedrock for Claude paid fallback.
   - Shell/CLI adapters for Cloudflare, Dokploy, AWS, Azure, GCP, Hetzner, Tailscale, Stripe, n8n, GitHub, and other registered infrastructure tools.

4. **Capability Registry**
   - Skills are capabilities, not the orchestrator itself.
   - Initial skill capabilities: `/code`, `/design`, `/research`, `/web`, `/video`.
   - Initial CLI capabilities come from existing Brain skills/runbooks and installed CLIs.
   - Each capability declares: input contract, output contract, safety class, required approvals, preferred AI task types, and verification commands.

5. **Run State and Memory**
   - Use Brain Core for active run state and immutable event logs.
   - Use the existing shared memory layer for durable preferences, decisions, and learned patterns.
   - Do not let agents freely write to Mind or global Brain policy. They propose memory and decision updates for approval.

6. **Safety**
   - Read-only planning is allowed by default.
   - File writes, commits, pushes, deploys, DNS changes, database mutations, credential-sensitive operations, and destructive commands require approval.
   - The orchestrator must record plan, selected executor, selected model/provider, commands run, files touched, verification output, and unresolved risk.

## Design Principles To Adopt

- **Progressive capability loading:** load skill names/descriptions first; load full instructions only when needed.
- **Persistent task ledger:** work must survive crashes, restarts, and handoffs.
- **Coordinator plus workers:** one orchestrator decomposes work; worker agents execute scoped tasks.
- **Resource-aware scheduling:** local M4/M1 capacity should be used concurrently for simple parallel tasks, but only within model/task capability limits.
- **Token and cost budgets:** Codex CLI is not a direct per-call API cost, but it is still subscription-rate-limited. Bedrock is the explicit paid fallback.
- **Approval-gated autonomy:** autonomous planning and verification are acceptable; autonomous deploy/DNS/credential changes are not.
- **Skill and CLI reuse:** do not re-implement code/design/research/web/video workflows. The agent orchestrator calls those orchestrators.

## What Not To Do

- Do not fold agent orchestration into the AI Model Selector.
- Do not install a general external agent framework as the main runtime.
- Do not make OpenAI API or Anthropic API direct providers.
- Do not bypass existing Brain skills and runbooks with one-off prompts.
- Do not start with autonomous production deploys. Start with read-only capability discovery and run tracking.

## First Implementation Step

Build a read-only Agent Capability Registry in Brain Core.

It should index:
- registered skills and their `SKILL.md` frontmatter/descriptions,
- known CLI capabilities from Brain skills/runbooks,
- AI execution surfaces from the AI Model Selector `/providers` endpoint,
- safety classes and required approval levels.

The first endpoint can be read-only:

```text
GET /api/agent/capabilities
```

First CLI smoke command:

```text
brain-agent capabilities
```

This is the safest foundation: it makes the orchestrator aware of what it can use before it can mutate anything.
