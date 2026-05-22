# Brain Agent Orchestrator Architecture

**Status:** Draft architecture contract
**Last updated:** 2026-05-22
**Research basis:** `agent-orchestrator-research-2026-05-22.md`

## Purpose

The Brain Agent Orchestrator is the project-level agent mode for Brain. It coordinates multi-step work across local AI, Codex CLI, Amazon Bedrock Claude, the Brain skills layer, and approved infrastructure CLIs.

It is not a model router. It consumes the AI Model Selector whenever LLM execution is needed.

```text
User goal
  -> Agent Orchestrator
      -> capability registry
      -> task graph
      -> approval gates
      -> run ledger
      -> AI Model Selector for LLM execution
      -> skill adapters and CLI adapters for work execution
```

## Layer Boundary

| Layer | Owns | Does not own |
|-------|------|--------------|
| AI Model Selector | Provider/model selection, local node health, rate limits, circuit breakers, selection audit | Project plans, skills, CLIs, approvals, repo state |
| Agent Orchestrator | Task decomposition, capability selection, run state, approvals, handoffs, verification | Low-level provider ranking, direct model health checks |
| Skills | Domain procedures and instructions | Global run state, provider selection |
| CLI adapters | Normalized execution of approved tools | Planning, autonomous policy decisions |
| Brain Console | Visibility and approval UI | Hidden autonomous execution |

## Provider Policy

Every LLM task goes through the AI Model Selector. Provider order:

1. Local Ollama on Mac Mini M4 Pro and MacBook M1.
2. Codex CLI through the ChatGPT subscription surface.
3. Amazon Bedrock Claude as the paid fallback.

Direct OpenAI API and direct Anthropic API are not valid executor surfaces.

## Initial Agent Roles

| Role | Purpose | Primary capabilities |
|------|---------|----------------------|
| Coordinator | Decompose goals, assign tasks, manage approvals and handoffs | Agent registry, run ledger, selector |
| Code | Implement repo changes and run verification | `/code`, git, test/build CLIs |
| Research | Collect and synthesize evidence | `/research`, NotebookLM, web tools |
| Web | Browse, scrape, test, and automate web flows | `/web`, Playwright/browser tools |
| Design | Produce UI/design direction and assets | `/design`, Canva/image tools when approved |
| Video | Run VO-specific media workflows | `/video`, FFmpeg, VO CLI |
| Infrastructure | Deploy and manage runtime infrastructure | Cloudflare, Dokploy, AWS, Azure, GCP, Hetzner, Tailscale |

Roles are registry entries, not hardcoded classes. The orchestrator can add roles later by adding capability records.

## Capability Registry

The registry is read-only in the first implementation phase.

```json
{
  "id": "skill.code",
  "kind": "skill",
  "label": "Code Orchestrator",
  "source": "brain/ai/skills/custom/code/SKILL.md",
  "description": "Routes coding work through understanding, planning, implementation, review, and shipping workflows.",
  "input_contract": "natural_language_goal",
  "output_contract": "plan_or_patch_or_review",
  "safety_class": "repo_write",
  "requires_approval_for": ["file_write", "commit", "push", "deploy"],
  "preferred_ai_task_types": ["code_generation", "code_review"],
  "verification": ["tests", "lint", "git diff --check"]
}
```

Capability kinds:
- `skill`
- `cli`
- `ai_surface`
- `service`
- `workflow`

Safety classes:
- `read_only`
- `local_write`
- `repo_write`
- `external_state`
- `credential_sensitive`
- `destructive`
- `financial`

## Run Ledger

The run ledger is append-only for auditability.

```json
{
  "run_id": "agentrun_20260522_001",
  "goal": "Build and deploy a production app",
  "repo": "/Users/Office/Repos/example/app",
  "status": "planning",
  "created_at": "2026-05-22T19:30:00+01:00",
  "updated_at": "2026-05-22T19:35:00+01:00",
  "tasks": [],
  "events": []
}
```

Each event records:
- timestamp,
- actor role,
- action,
- capability used,
- selected AI provider/model when relevant,
- command or endpoint when relevant,
- files touched,
- approval id when relevant,
- verification output,
- risk note.

## Task Graph

Tasks are dependency-aware units of work.

```json
{
  "task_id": "task_001",
  "title": "Create deployment plan",
  "status": "pending",
  "depends_on": [],
  "role": "Infrastructure",
  "capabilities": ["cli.cloudflare", "cli.dokploy"],
  "ai_task_type": "infrastructure_planning",
  "approval_required": false
}
```

Allowed statuses:

```text
pending | planned | waiting_approval | running | blocked | completed | failed | cancelled
```

## Approval Model

Read-only planning and verification can run without approval.

Approval is required for:
- file writes,
- commits,
- pushes,
- deploys,
- DNS changes,
- database mutations,
- destructive commands,
- credential-sensitive commands,
- external billing or financial actions,
- memory promotion,
- decision-log writes.

Approval records must include:
- requested action,
- reason,
- risk class,
- exact command or mutation when available,
- expected rollback,
- approver,
- decision,
- timestamp.

## Executor Contract

Each executable task resolves to an executor plan:

```json
{
  "task_id": "task_001",
  "executor": "codex-cli",
  "selector_result": {
    "provider_id": "codex-cli",
    "model": "gpt-5.4",
    "reason": "local model insufficient for repo-wide implementation"
  },
  "capability": "skill.code",
  "mode": "dry_run",
  "timeout_sec": 120,
  "approval_required": false
}
```

Execution modes:
- `dry_run`
- `read_only`
- `approved_write`
- `approved_external_state`

## First Implementation Slice

Implement only:

1. capability registry indexer,
2. AI Model Selector `/providers` adapter,
3. CLI capability manifest,
4. `GET /api/agent/capabilities`,
5. `brain-agent capabilities`.

No task execution, file writing, deployment, or DNS changes are part of the first slice.
