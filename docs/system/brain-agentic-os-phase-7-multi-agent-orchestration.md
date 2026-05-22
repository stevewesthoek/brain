# Phase 7: Multi-Agent Orchestration

**Date:** 2026-06-08
**Phase:** 7
**Duration:** 2026-06-08 → 2026-06-20
**Owner:** Steve Westhoek
**Dependencies:** Phases 1-6 complete (especially Phase 6 ledger)

---

## Vision

Enable Brain to coordinate multiple AI agents working in parallel on independent sub-tasks, with work stealing, load balancing, and transaction-like semantics for complex workflows. Agents (Claude Code, Codex, Gemini) can spawn parallel sub-agents, wait for completion, and merge results safely.

---

## Current State

**What exists:**
- Single-agent orchestration: Claude Code, Codex, Gemini each run independently
- Sequential task execution: wait for one task to complete before starting next
- No inter-agent coordination or parallel work

**What's missing:**
- Parallel subagent spawning (start 3 agents reviewing different modules simultaneously)
- Work queue and task distribution
- Result aggregation and merging
- Transaction-like semantics (all-or-nothing execution)
- Load balancing across agents
- Deadlock detection and recovery
- Cost tracking per parallel operation

---

## Architecture

### Multi-Agent Workflow Model

```
Agent Coordinator (Claude Code, Sonnet)
  ├── Analyze work
  ├── Decompose into 3 parallel subtasks
  └── Spawn Pool
      ├─ Subagent 1 (Haiku) — Review Module A
      ├─ Subagent 2 (Haiku) — Review Module B
      └─ Subagent 3 (Haiku) — Review Module C
  ├── Monitor progress (poll ledger)
  ├── Aggregate results
  ├── Validate merged output
  └── Report to user

Cost:
  - Coordinator: Sonnet (expensive, reasoning)
  - Workers: Haiku (cheap, execution)
  - Savings: 60-70% vs sequential
```

### Work Queue

```
Queue
├── task_1 {status: pending, assigned_to: null, retry_count: 0}
├── task_2 {status: pending, assigned_to: null, retry_count: 0}
├── task_3 {status: in_progress, assigned_to: agent_2, started_at: ...}
├── task_4 {status: completed, assigned_to: agent_1, result: {...}}
└── task_5 {status: failed, assigned_to: agent_3, error: "..."}
```

### Ledger Integration

Each parallel operation logged with:
- `parallel_work_started` — coordinator spawns agents
- `agent_assigned_task` — subagent picks up work
- `agent_task_completed` — subagent finishes and reports
- `parallel_work_completed` — all agents done, results merged
- `parallel_work_failed` — timeout or error, rollback triggered

---

## Implementation Tasks

### Phase 7.1: Work Queue & Distribution (2026-06-08 → 2026-06-10)

**Task 7.1.1:** Define work queue schema
- File: `projects/brain-core/src/types/work-queue.ts`
- Types: Task, TaskStatus, TaskResult, WorkQueue
- Versioning: append-only state mutations

**Task 7.1.2:** Implement work queue manager
- File: `projects/brain-core/src/adapters/work-queue-manager.ts`
- Functions: enqueue(), dequeue(), updateStatus(), getProgress()
- Storage: `~/.local/brain-queues/work-queue.jsonl`
- Concurrency: atomic updates, no race conditions

**Task 7.1.3:** Create task distribution logic
- File: `projects/brain-core/src/adapters/task-distributor.ts`
- Function: assignTaskToAgent(task, agent)
- Load balancing: round-robin with exponential backoff on failures

### Phase 7.2: Subagent Spawning (2026-06-10 → 2026-06-12)

**Task 7.2.1:** Create subagent executor
- File: `projects/brain-core/src/adapters/subagent-executor.ts`
- Function: spawnSubagent(model, prompt, context)
- Execution: spawn process for Codex CLI or Gemini CLI
- Monitoring: poll ledger for completion events

**Task 7.2.2:** Implement agent pool manager
- File: `projects/brain-core/src/adapters/agent-pool.ts`
- Pool size: configurable (default 3)
- Lifecycle: create, idle, busy, complete, failed states
- Cost tracking: per-agent cost accumulation

**Task 7.2.3:** Add timeout and recovery
- Deadlock detection: if task idle > 5 minutes, mark as failed
- Retry logic: exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Resource cleanup: kill orphaned subagents on coordinator crash

### Phase 7.3: Result Aggregation (2026-06-12 → 2026-06-14)

**Task 7.3.1:** Create result merger
- File: `projects/brain-core/src/adapters/result-merger.ts`
- Function: mergeResults(results: TaskResult[])
- Conflict resolution: vote on decisions, prioritize errors
- Validation: ensure merged output is coherent

**Task 7.3.2:** Implement transaction semantics
- All-or-nothing: if any subagent fails, roll back all
- Checkpoint system: save state before merge
- Recovery: replay from checkpoint on failure

**Task 7.3.3:** Add result caching
- File: `projects/brain-core/src/adapters/result-cache.ts`
- Cache location: `~/.local/brain-queues/result-cache.jsonl`
- Deduplication: if same task queued twice, use cached result
- TTL: results valid for 1 hour

### Phase 7.4: Orchestration Skill (2026-06-14 → 2026-06-16)

**Task 7.4.1:** Create `/orchestrate` skill
- File: `ai/skills/custom/orchestrate/SKILL.md`
- Trigger phrases: "parallelize this", "review these 3 modules", "compare implementations"
- Integration: detects opportunities for parallel work automatically

**Task 7.4.2:** Update `/code` orchestrator
- File: `ai/skills/custom/code/SKILL.md`
- Add: "When to parallelize" section with decision rules
- Integration: trigger `/orchestrate` when work can be parallelized

**Task 7.4.3:** Create CLI for manual orchestration
- File: `tools/scripts/orchestrate.sh`
- Usage: `orchestrate --tasks <json-array> --agents 3 --timeout 300`
- Output: merged results + cost report

### Phase 7.5: Monitoring & Debugging (2026-06-16 → 2026-06-18)

**Task 7.5.1:** Add parallel work tracking to ledger
- Event types: `parallel_work_started`, `agent_assigned_task`, `parallel_work_completed`, `parallel_work_failed`
- Fields: coordinator_id, subagent_ids, task_count, duration, total_cost

**Task 7.5.2:** Create orchestration dashboard
- File: `projects/brain-console-obsidian/src/views/orchestration-view.ts`
- Display: active parallel operations, per-agent cost, queue depth
- Interaction: pause/resume work, inspect task results

**Task 7.5.3:** Write orchestration debugging runbook
- File: `operations/runbooks/multi-agent-orchestration-debugging.md`
- Scenarios: deadlock detection, cost overruns, task failures, result conflicts
- Recovery: manual intervention procedures

### Phase 7.6: Documentation & Finalization (2026-06-18 → 2026-06-20)

**Task 7.6.1:** Write orchestration standard
- File: `operations/standards/multi-agent-orchestration-standard.md`
- When to parallelize: decision tree
- Cost-benefit analysis: when parallelization saves money
- Limitations: what cannot be parallelized

**Task 7.6.2:** Create implementation plan for Phase 8
- File: `docs/system/brain-agentic-os-implementation-plan-phase-8.md`
- Phase 8: Cost Transparency & Model Routing Optimization
- 14-16 tasks designed for Haiku/Codex Mini

**Task 7.6.3:** Update strategy and roadmap
- Update: `docs/system/brain-agentic-os-strategy.md`
- Update: `docs/system/brain-agentic-os-roadmap.md`
- Add Phase 7 completion status

**Task 7.6.4:** Commit and push to main

---

## Success Criteria

1. Multiple agents can be spawned and work in parallel
2. Work queue automatically distributes tasks to available agents
3. Coordinator waits for all subagents to complete
4. Results are merged safely with conflict resolution
5. Cost savings: 60%+ reduction vs sequential execution for parallelizable work
6. Ledger tracks all parallel operations with full forensics
7. Timeouts and deadlocks are detected and recovered
8. CLI tool allows manual orchestration with full control
9. Dashboard shows real-time status of parallel operations
10. All infrastructure works across Claude Code, Codex, Gemini

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| Work Queue | Persisted to `~/.local/brain-queues/work-queue.jsonl` |
| Agent Ledger | All parallel operations logged (Phase 6) |
| /code orchestrator | Detects parallelizable work automatically |
| /orchestrate skill | Manual orchestration with trigger phrases |
| Brain Console | Real-time dashboard for active operations |
| Cost tracking | Per-subagent cost accumulation and reporting |

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Subagent deadlock | Timeout detection (5 min), automatic retry, coordinator recovery |
| Resource exhaustion | Pool size limit (default 3), backpressure on enqueue |
| Result merge conflicts | Vote-based conflict resolution, error prioritization |
| Cost explosion | Monitor per-operation cost, alert if >10x budget, auto-pause |
| Ledger logging overhead | Async writes, batch every 100ms, low impact |

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `brain-agentic-os-strategy.md` | Core vision and architecture |
| `brain-agentic-os-roadmap.md` | Phase timeline and dependencies |
| `brain-agentic-os-phase-6-ledger-auditability.md` | Ledger system (required for tracking) |
| `operations/standards/multi-agent-orchestration-standard.md` | Decision rules (to be created) |
| `operations/runbooks/multi-agent-orchestration-debugging.md` | Debugging workflows (to be created) |

---

## Next Phase

**Phase 8: Cost Transparency & Model Routing Optimization (2026-06-21 → 2026-07-05)**

- Real-time cost tracking per task/phase
- Automatic model routing based on task complexity
- Budget caps and escalation policies
- Cost optimization recommendations
