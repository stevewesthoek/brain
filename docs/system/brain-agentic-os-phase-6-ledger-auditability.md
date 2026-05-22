# Phase 6: Agent Ledger & Auditability

**Date:** 2026-05-22
**Phase:** 6
**Duration:** 2026-05-29 → 2026-06-07
**Owner:** Steve Westhoek
**Dependencies:** Phases 1-5 complete

---

## Vision

Extend Brain's agent ledger system from read-only snapshots to a complete append-only audit trail with forensic replay, decision tracking, and compliance reporting. Enable reproducible debugging, accountability, and governance workflows.

---

## Current State

**What exists (brain-core):**
- `agent-ledger.ts` — read-only snapshot adapter
- `agent-runs.ts` — list historical agent runs
- `agent-task-state.ts` — task graph with dependency tracking
- `agent-executor-plan.ts` — planned task sequences
- Approval gates surface (API endpoints for UI visibility)
- Task graph with dependency resolution

**What is missing:**
- Append-only ledger file format (currently snapshots only)
- Decision logging (why an agent chose path A over B)
- Tool call audit trail (every API call logged with inputs/outputs)
- State mutation tracking (every variable change recorded)
- Forensic replay capability (replay any past session given ledger entry)
- Query interface for compliance/analysis
- Integration with agent orchestrators (Claude Code / Codex / Gemini)

---

## Architecture

### Append-Only Ledger Format

Ledger stored at `~/.local/brain-ledger/ledger.jsonl` (per-machine) + optional `.brain/agent-ledger.jsonl` (per-repo).

**Each line is immutable:**
```json
{
  "id": "evt_2026-05-22_001",
  "timestamp": "2026-05-22T14:23:45.123Z",
  "sessionId": "sess_abc123",
  "agent": "claude-code",
  "type": "decision",
  "actor": "haiku-4.5",
  "metadata": {
    "model": "claude-haiku-4-5-20251001-v1",
    "cost": 0.0015,
    "tokens": { "input": 2000, "output": 500 }
  },
  "payload": {
    "action": "chose_model",
    "reason": "task_requires_multiple_files",
    "from": "haiku",
    "to": "sonnet",
    "justification": "codebase analysis spans 15 files, context needed"
  },
  "signature": "sha256_hash_of_immutable_fields"
}
```

### Event Types

| Type | When | Payload | Example |
|------|------|---------|---------|
| **session_start** | New session begins | repo, tool, user, context_size | `{ repo: "brain", tool: "claude-code", contextTokens: 50000 }` |
| **model_escalation** | Model routing decision | from, to, reason, cost_impact | `{ from: "haiku", to: "sonnet", reason: "complex_reasoning_needed" }` |
| **tool_call** | API invocation | tool_name, args, result, duration_ms | `{ tool: "bash", command: "git status", exitCode: 0, stdoutLines: 50 }` |
| **state_mutation** | Variable/file changed | path, old_value, new_value, reason | `{ path: "CLAUDE.md", operation: "edit", lines_changed: 5 }` |
| **decision** | AI chose an action | options_considered, choice, rationale, alternatives | `{ options: [fix_now, defer], choice: "fix_now", reason: "blocking" }` |
| **approval_requested** | Sent for human approval | action_id, risk_level, approval_deadline | `{ action: "force_push_main", riskLevel: "critical" }` |
| **approval_granted** | Approval received | action_id, approver, comment | `{ action: "force_push_main", approver: "steve" }` |
| **approval_rejected** | Approval denied | action_id, approver, reason | `{ action: "force_push_main", reason: "not_reviewed_yet" }` |
| **error_encountered** | Exception/failure | error_type, message, stack_trace, recovery_step | `{ type: "git_conflict", recovery: "manual_merge_needed" }` |
| **verification_passed** | QA gate passed | checks_run, result | `{ verifier: "greploop", iteration: 2, allChecksPassed: true }` |
| **session_end** | Session completes | outcome, total_cost, decision_count | `{ outcome: "success", totalCost: 0.75, decisionsLogged: 47 }` |

### Query Interface

```bash
# List recent events
ledger query --recent 20 --type decision

# Search for escalations
ledger query --type model_escalation --from haiku --after 2026-05-20

# Replay a session
ledger replay --session sess_abc123

# Compliance report
ledger report --approval-required --status granted --user steve

# Cost analysis
ledger cost --agent claude-code --repo brain --period week
```

---

## Implementation Tasks

### Phase 6.1: Ledger File Format & Writer (2026-05-29)

**Task 6.1.1:** Define ledger entry schema
- File: `projects/brain-core/src/types/agent-ledger.ts`
- Create TypeScript interfaces for all event types
- Define entry signature scheme (SHA256 hash of immutable fields)
- Version schema with backwards-compat rules

**Task 6.1.2:** Implement append-only ledger writer
- File: `projects/brain-core/src/adapters/agent-ledger-writer.ts`
- Function: `writeEventToLedger(event: AgentLedgerEntry): boolean`
- Validation: type check, timestamp monotonicity, signature generation
- Error handling: mkdir, fsync, permission errors
- Tests: valid writes, concurrent writes, filesystem failures

**Task 6.1.3:** Implement ledger reader with query
- File: `projects/brain-core/src/adapters/agent-ledger-reader.ts`
- Function: `queryLedger(filter: LedgerQuery): AgentLedgerEntry[]`
- Filters: type, agent, timeRange, sessionId, actor
- Ordering: chronological, with seek-to-timestamp optimization
- Tests: filters, performance on 10K+ entries

### Phase 6.2: Hook Integration (2026-05-30)

**Task 6.2.1:** Create Claude Code ledger hook
- File: `~/.claude/hooks/ledger-writer-hook.sh`
- Trigger: UserPromptSubmit, ToolUse, ToolResult
- Capture: model used, tool called, result status, duration
- Payload: send to ledger writer via HTTP or CLI

**Task 6.2.2:** Create Codex ledger hook
- File: `~/.codex/hooks/ledger-writer-hook.sh`
- Mirror Claude Code hook implementation
- Test: verify events appear in shared ledger

**Task 6.2.3:** CLI tool for manual ledger writes
- File: `tools/scripts/ledger-write.sh`
- Exposes: `ledger-write --type <type> --payload <json>`
- Use case: manual annotations, approvals, external events

### Phase 6.3: Query & Replay (2026-05-31)

**Task 6.3.1:** Implement query CLI
- File: `tools/scripts/ledger-query.sh`
- Commands: recent, search, filter, stream, tail
- Output: formatted JSON, CSV, markdown table
- Tests: various filter combinations

**Task 6.3.2:** Implement replay capability
- File: `tools/scripts/ledger-replay.sh`
- Capability: given a session ID, recreate state snapshot at any point
- Use case: forensic debugging (why did agent choose X?)
- Limitation: can inspect state, not re-run

**Task 6.3.3:** Compliance report generator
- File: `tools/scripts/ledger-report.sh`
- Reports: approval chain, cost breakdown, error frequency, decision audit
- Audience: governance, stakeholders, retrospectives

### Phase 6.4: Brain Console Integration (2026-06-02)

**Task 6.4.1:** Extend Brain Console ledger view
- File: `projects/brain-console-obsidian/src/views/agent-ledger-view.ts`
- Display: real-time event stream, filtered by type/agent
- Interaction: click event to see full details, expand nested payloads

**Task 6.4.2:** Cost transparency widget
- File: `projects/brain-console-obsidian/src/views/cost-tracking-widget.ts`
- Display: live cost counter (today, week, month)
- Breakdown: by model, by task, by repo
- Alert: when approaching budget

**Task 6.4.3:** Decision audit trail view
- File: `projects/brain-console-obsidian/src/views/decision-audit-view.ts`
- Timeline: all decisions in current session
- Context: why each decision was made
- Alternatives: what was considered but rejected

### Phase 6.5: Documentation & Migration (2026-06-07)

**Task 6.5.1:** Write ledger standard
- File: `operations/standards/agent-ledger-standard.md`
- Schema: full entry definitions
- Event taxonomy: all types and when they fire
- Query examples: common patterns

**Task 6.5.2:** Write forensic debugging runbook
- File: `operations/runbooks/ledger-forensic-debugging.md`
- Scenario: "agent chose wrong path, why?"
- Scenario: "session failed, what went wrong?"
- Scenario: "cost spike detected, where did it go?"

**Task 6.5.3:** Update strategy and roadmap
- Update: `docs/system/brain-agentic-os-strategy.md`
- Update: `docs/system/brain-agentic-os-roadmap.md`
- Add Phase 6 completion status and learnings

**Task 6.5.4:** Create implementation plan for Phase 7
- File: `docs/system/brain-agentic-os-implementation-plan-phase-7.md`
- Phase 7: Multi-Agent Orchestration (parallel subagent work)
- 12-15 tasks designed for Haiku/Codex Mini execution

---

## Success Criteria

1. Every agent action is logged to an append-only ledger
2. Ledger entries include: timestamp, actor, action, inputs, outputs, reason
3. Given any ledger entry, a developer can replay context and understand why that decision was made
4. Query interface allows filtering by type, agent, time, cost
5. Brain Console displays real-time event stream and cost tracking
6. Compliance reports can be generated for audit/governance workflows
7. Zero performance impact on agent loop (async ledger writes)
8. All ledger infrastructure works across Claude Code, Codex, Gemini

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| Claude Code | Hook writes events to ledger during ToolUse / ToolResult |
| Codex CLI | Hook writes events to ledger during execution |
| Gemini CLI | Hook writes events to ledger during execution |
| Brain Core API | `/agent-ledger` endpoint returns queryable snapshot |
| Brain Console | Real-time widget displays event stream + cost tracking |
| Task System | Task state transitions logged as events |
| Approval Gates | Approval requests/grants/rejects logged |
| Guardrails | Policy violations logged with severity |

---

## Backwards Compatibility

- Existing snapshot-based ledger continues to work
- New append-only ledger is opt-in (write via hook)
- Query interface defaults to recent entries (performance)
- Brain Core API bumped to v2 (ledger as first-class concept)
- No breaking changes to existing tools/workflows

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Ledger file grows unbounded | Implement rotation: ledger.jsonl.1, .2, etc. Compress old entries. Query respects rotation. |
| Sensitive data in ledger | Sanitize payloads before writing (mask tokens, paths, secrets). Audit sanitization rules. |
| Performance impact | Async ledger writes. Buffer entries. Batch writes every 1-5 seconds. |
| Query performance on large ledger | Index by timestamp + type. Support seeking to time range. Limit default query to recent 1000 entries. |
| Hook conflicts | Deduplicate hook calls. Add idempotency token to prevent double-logging. |

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `brain-agentic-os-strategy.md` | Core vision and architecture |
| `brain-agentic-os-roadmap.md` | Phase timeline and dependencies |
| `operations/standards/agent-ledger-standard.md` | Ledger schema and event taxonomy (to be created) |
| `operations/runbooks/ledger-forensic-debugging.md` | Debugging workflows using ledger (to be created) |
| `ai/policy/guardrails.md` | Safety guardrails (logging violations) |

---

## Next Phase

**Phase 7: Multi-Agent Orchestration (2026-06-08 → 2026-06-20)**

- Coordinate parallel subagent work (e.g., 3 agents reviewing different modules simultaneously)
- Implement work stealing and load balancing
- Add transaction-like semantics for complex multi-step operations
- Leverage ledger for forensic analysis of multi-agent workflows
