# Agent Mode K1.3 Runtime Surfaces Evidence — 2026-09-09

## Result

K1.3 passes as a human/runtime integration refinement. K1 is complete for the
offline gates; K2 was not started. No live Jarvis, worker, AWS model probe,
Herdr state mutation, deployment, LaunchAgent change, commit, or push occurred.

## Operating model

```text
USER → repos.sh / sessions.sh / Herdr
     → BRAIN CONTROL HARNESS
       → K1.2 policy + StateStore + ModelGateway
         → MiniMax M2.5 | GLM-5 | Claude Opus 4.6
       → optional restricted DeepSeek Harness AgentRuntime
       → Claude Code specialist runtime
       → Codex specialist/subscription runtime
```

The user normally launches `repos`, chooses a repository, and selects Brain
Auto or an explicit Brain tier. Brain performs model selection/admission;
scripts only provide intent and navigation. Brain may later launch the
restricted DeepSeek Harness runtime internally. Claude Code remains a direct
specialized Claude coding surface. Codex remains a separate quota-aware
subscription resource. Herdr is a workspace/terminal/fleet surface whose Brain
agent definition runs `brain-agent --model auto`; Herdr is not task, budget,
model, or permission authority.

## Surface changes

- `repos.sh` menu: Brain / Auto, Brain / MiniMax M2.5, Brain / GLM-5,
  Brain / Opus 4.6, Claude Code, Codex.
- `brain-agent --model auto|minimax-m2.5|glm-5|opus-4.6` emits a structured
  Brain policy request; explicit overrides pass through the K1.2 fixed-policy
  admission preflight and invalid/local model names fail closed. The command
  does not call AWS merely to normalize a request.
- `sessions.sh` menu: Brain, Claude Code, Codex. Brain rows come only from the
  durable Brain Core `/agent-console` observer and show attempt identity,
  repository when available, selected model/tier, runtime, status, and activity.
  Missing StateStore/API yields no synthetic Brain rows. Brain resume is not
  advertised until K2 adds a canonical durable resume command; Claude/Codex
  keep native resume behavior.
- `jump.sh` remains navigation-only.

Herdr remains outside Brain-managed ownership. A documented application-local
definition is provided in `operations/runbooks/agent-mode-runtime-surfaces.md`
without changing private Herdr configuration.

## Validation

- `bash tools/scripts/agent-mode-k1-3-runtime-surfaces.test.sh` passed.
- `bash -n` passed for `repos.sh`, `sessions.sh`, and `jump.sh`.
- 62 focused Agent Mode/K0/K1 tests passed, including 27 K1.2 policy tests,
  manual model override admission, K1.1 gateway/portfolio/managed-provider
  coverage, restricted Harness topology, and StateStore fixtures.
- Brain Core TypeScript typecheck passed.
- The runtime menu and CLI request path performed no AWS call.

## Completion decision

K1.3 is complete. Exact next task: K2 — one live Jarvis plus one worker
vertical slice. Do not begin K2 automatically.
