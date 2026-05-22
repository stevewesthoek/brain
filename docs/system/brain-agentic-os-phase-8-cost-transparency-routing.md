# Phase 8: Cost Transparency & Model Routing Optimization

**Date:** 2026-06-08
**Phase:** 8
**Duration:** 2026-06-21 -> 2026-07-05
**Owner:** Steve Westhoek
**Dependencies:** Phases 1-7 complete, especially Phase 6 ledger and Phase 7 orchestration

---

## Vision

Make Brain cost-aware at the task and agent level. Track spend in real time, route work to the cheapest capable model by default, escalate only when needed, and surface the whole thing in Brain Console.

This phase is about transparency and control, not autonomy for its own sake.

---

## Current State

**What exists:**
- Agent ledger and audit trail
- Multi-agent orchestration primitives
- Read-only agent console summary surface
- Existing model routing in the Video Orchestrator stack
- Existing Brain Console dashboard patterns for read-only summary cards

**What is missing:**
- Cost events in the ledger
- Per-task and per-agent cost aggregation
- Model routing policy with explicit escalation rules
- Budget thresholds and alerting
- Brain Console cost dashboard widget
- Operational standard for cost transparency and routing

---

## Architecture

### Cost Data Model

Track cost at three levels:
- **Session**: total cost for one user/session run
- **Task**: cost for one logical task or subtask
- **Agent**: accumulated spend by agent/model/provider

Each cost event should include:
- timestamp
- repo
- session id
- task id
- agent id
- model id
- provider id
- token counts or usage units
- estimated cost
- routing reason
- escalation reason, if any

### Routing Model

Default routing order:
1. Cheapest capable local model
2. Subscription-backed CLI route
3. Paid fallback model

Escalation should be based on:
- task complexity
- context size
- codebase breadth
- deadline/urgency
- prior attempt quality
- local model availability and health

### Budget Model

Budgets should be configurable by:
- per-session
- per-repo
- per-day
- per-week
- per-agent/model/provider

Budget enforcement levels:
- warn
- throttle
- require approval
- pause routing to expensive tiers

---

## Implementation Tasks

### Phase 8.1: Cost Event Schema and Ledger Integration (2026-06-21)

**Task 8.1.1:** Define cost event types
- File: `projects/brain-core/src/types/agent-ledger.ts`
- Add cost-specific ledger entry types
- Include model, provider, token usage, estimated cost, and routing reason

**Task 8.1.2:** Implement cost event writer
- File: `projects/brain-core/src/adapters/agent-ledger-writer.ts`
- Write cost events alongside existing ledger entries
- Keep append-only semantics

**Task 8.1.3:** Add cost query helpers
- File: `projects/brain-core/src/adapters/agent-ledger-reader.ts`
- Query by repo, session, agent, model, date range
- Aggregate by task/session/provider

---

### Phase 8.2: Routing Policy Engine (2026-06-23)

**Task 8.2.1:** Define routing policy types
- File: `projects/brain-core/src/types/model-routing.ts`
- Describe capability thresholds, escalation rules, and fallback hierarchy

**Task 8.2.2:** Implement routing policy adapter
- File: `projects/brain-core/src/adapters/model-routing-policy.ts`
- Function: `selectModelRoute(task, context, budget, health)`
- Output: model/provider choice plus rationale

**Task 8.2.3:** Add escalation logic
- Promote local -> CLI -> paid fallback based on task complexity
- Preserve explicit reasoning for every escalation

---

### Phase 8.3: Budget Controls and Alerts (2026-06-25)

**Task 8.3.1:** Implement budget state storage
- File: `projects/brain-core/src/adapters/cost-budgets.ts`
- Store thresholds and rolling spend windows

**Task 8.3.2:** Add budget check helpers
- Evaluate spend before routing
- Return warn/throttle/block state

**Task 8.3.3:** Add alert events
- Emit warnings when approaching budget
- Emit block events when an expensive tier would exceed the budget

---

### Phase 8.4: Brain Console Cost Dashboard (2026-06-27)

**Task 8.4.1:** Add aggregated cost summary endpoint
- File: `projects/brain-core/src/api/routes.ts`
- Endpoint: `GET /agent-cost-summary`
- Read-only summary of spend by session, task, agent, and provider

**Task 8.4.2:** Add console widget
- File: `projects/brain-console-obsidian/src/view.ts`
- Show today / week / month spend
- Show cheapest route chosen vs escalated route chosen
- Show budget warning state

**Task 8.4.3:** Add detail drilldown
- Show the last 10 expensive tasks
- Show routing rationale for each escalation

---

### Phase 8.5: Standards and Validation (2026-07-01)

**Task 8.5.1:** Write cost transparency standard
- File: `operations/standards/agent-cost-transparency-standard.md`
- Define cost fields, units, and reporting expectations

**Task 8.5.2:** Write model routing standard
- File: `operations/standards/agent-model-routing-standard.md`
- Define local-first rules, escalation policy, and fallback behavior

**Task 8.5.3:** Add validation tests
- Ensure cost events are emitted
- Ensure routing choices are explainable
- Ensure budget blocks work as expected

**Task 8.5.4:** Update strategy and roadmap
- Update `docs/system/brain-agentic-os-strategy.md`
- Update `docs/system/brain-agentic-os-roadmap.md`
- Record Phase 8 completion once shipped

---

## Success Criteria

1. Every routed task can report what it cost
2. Routing decisions are explainable and reproducible
3. Cheapest capable route is chosen by default
4. Escalations are explicit and logged
5. Budget thresholds can warn or block expensive routing
6. Brain Console shows cost summaries and recent expensive tasks
7. Operational standards define how the routing system should behave
8. The system remains read-only until explicitly approved for any mutation path

---

## Completion

Implemented in this phase:

- Read-only `/agent-cost-summary` surface in Brain Core
- Selector-aware routing policy adapter
- Budget state and status evaluation
- Brain Console cost dashboard widget
- Cost transparency and routing standards

The phase remains read-only by design. Mutation and runtime cost emission can be added in a later expansion if needed.

---

## Notes

- This phase should stay additive and isolated.
- Do not break existing ledger, orchestration, or console surfaces.
- Keep all new routes read-only unless a later phase explicitly adds mutation.
