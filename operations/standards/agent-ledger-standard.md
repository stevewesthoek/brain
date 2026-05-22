# Agent Ledger Standard

**Version:** 1.0  
**Date:** 2026-05-22  
**Owner:** Steve Westhoek

---

## Overview

The Agent Ledger is an append-only event log for all agent operations. Each entry is immutable, timestamped, signed, and designed for forensic analysis and compliance reporting.

**Location:** `~/.local/brain-ledger/ledger.jsonl` (per-machine) or `.brain/agent-ledger.jsonl` (per-repo)

**Format:** JSONL (one JSON object per line, no commas between lines)

---

## Entry Structure

Every ledger entry has this schema:

```json
{
  "id": "evt_20260522_142345_abc123",
  "version": "1.0",
  "timestamp": "2026-05-22T14:23:45.123Z",
  "sessionId": "sess_unique_id",
  "agent": "claude-code",
  "type": "tool_call",
  "actor": "haiku",
  "severity": "info",
  "status": "completed",
  "metadata": {
    "model": "haiku",
    "cost": 0.0015,
    "tokens": { "input": 2000, "output": 500 },
    "duration_ms": 1500
  },
  "payload": { ... },
  "signature": "sha256_hash"
}
```

### Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | yes | Unique event ID (evt_{timestamp}_{random}) |
| `version` | string | yes | Schema version (1.0) |
| `timestamp` | ISO 8601 | yes | When event occurred (UTC) |
| `sessionId` | string | yes | Links events to session |
| `agent` | enum | yes | Which runtime: claude-code, codex-cli, gemini-cli |
| `type` | enum | yes | Event category (see taxonomy below) |
| `actor` | enum | yes | Which model executed: haiku, sonnet, opus, etc. |
| `severity` | enum | yes | info, warning, error, critical |
| `status` | enum | yes | pending, completed, failed, skipped |
| `metadata` | object | yes | Cost, tokens, duration |
| `payload` | object | yes | Event-specific data (varies by type) |
| `signature` | string | optional | SHA256 hash of immutable fields |

---

## Event Taxonomy

### session_start
When a new session begins.

```json
{
  "type": "session_start",
  "payload": {
    "repo": "brain",
    "tool": "claude-code",
    "user": "steve",
    "context_size_tokens": 50000,
    "handoff_loaded": true
  }
}
```

### session_end
When a session completes.

```json
{
  "type": "session_end",
  "payload": {
    "outcome": "success",
    "total_cost": 0.75,
    "event_count": 47,
    "decision_count": 12,
    "error_count": 0,
    "duration_seconds": 1234
  }
}
```

### tool_call
When an agent invokes a tool.

```json
{
  "type": "tool_call",
  "payload": {
    "tool_name": "bash",
    "tool_type": "bash",
    "args": { "command": "git status" },
    "tags": ["git", "readonly"]
  }
}
```

### tool_result
When tool execution completes.

```json
{
  "type": "tool_result",
  "payload": {
    "tool_name": "bash",
    "exit_code": 0,
    "success": true,
    "output_lines": 50,
    "duration_ms": 500
  }
}
```

### model_escalation
When an agent chooses to use a more powerful model.

```json
{
  "type": "model_escalation",
  "payload": {
    "from": "haiku",
    "to": "sonnet",
    "reason": "complex_code_review",
    "cost_impact": 0.50,
    "justification": "Task requires understanding cross-module dependencies"
  }
}
```

### decision
When an agent makes a significant choice.

```json
{
  "type": "decision",
  "payload": {
    "context": "review found 3 issues",
    "options": ["fix_now", "defer"],
    "choice": "fix_now",
    "rationale": "All issues are blockers",
    "confidence": 0.95
  }
}
```

### error_encountered
When an exception or failure occurs.

```json
{
  "type": "error_encountered",
  "payload": {
    "error_type": "git_conflict",
    "message": "Merge conflict in main.ts",
    "severity": "recoverable",
    "recovery_step": "Manual merge required"
  }
}
```

### approval_requested
When an action requires human approval.

```json
{
  "type": "approval_requested",
  "payload": {
    "action_id": "force_push_main_123",
    "action_description": "Force push to main branch",
    "risk_level": "critical",
    "approval_deadline": "2026-05-22T15:00:00Z"
  }
}
```

### approval_granted
When approval is given.

```json
{
  "type": "approval_granted",
  "payload": {
    "action_id": "force_push_main_123",
    "approver": "steve",
    "comment": "Checked manually, safe to proceed"
  }
}
```

### approval_rejected
When approval is denied.

```json
{
  "type": "approval_rejected",
  "payload": {
    "action_id": "force_push_main_123",
    "approver": "steve",
    "reason": "Not reviewed yet"
  }
}
```

### state_mutation
When a file or variable changes.

```json
{
  "type": "state_mutation",
  "payload": {
    "type": "file_edit",
    "path": "src/main.ts",
    "operation": "update",
    "reason": "Fix type error on line 45",
    "lines_changed": 3
  }
}
```

### verification_passed
When a QA gate passes.

```json
{
  "type": "verification_passed",
  "payload": {
    "verifier": "greploop",
    "iteration": 2,
    "checks_run": ["compile", "lint", "tests"],
    "all_passed": true
  }
}
```

### verification_failed
When a QA gate fails.

```json
{
  "type": "verification_failed",
  "payload": {
    "verifier": "review",
    "iteration": 1,
    "checks_run": ["code-quality", "security"],
    "all_passed": false,
    "failures": ["Potential null reference on line 87"]
  }
}
```

---

## Query Interface

### CLI Commands

List recent 20 entries:
```bash
ledger-query --recent 20
```

Search by type:
```bash
ledger-query --type tool_call --format table
```

Filter by agent:
```bash
ledger-query --agent claude-code --recent 50
```

Replay a session:
```bash
ledger-replay sess_abc123
```

Generate audit report:
```bash
ledger-report --type audit
```

---

## Backwards Compatibility

- Schema is versioned. Current: 1.0
- Field additions are append-only (new optional fields don't break readers)
- Breaking changes require version bump (2.0) and migration plan
