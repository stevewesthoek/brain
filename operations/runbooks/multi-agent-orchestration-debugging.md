# Multi-Agent Orchestration Debugging Runbook

**Date:** 2026-06-08  
**Audience:** Developers, Operations  
**Purpose:** Debug multi-agent orchestration issues

---

## Scenario 1: Parallel Work Times Out

**Problem:** Orchestration didn't complete within timeout window.

**Steps:**

1. Check ledger for events:
   ```bash
   ledger-query --type parallel_work_started --recent 10
   ```

2. Find incomplete work:
   ```bash
   ledger-query --type parallel_work_completed --recent 10
   ```

3. Compare: if more starts than completes, timeout occurred

4. Replay session to see last event:
   ```bash
   ledger-replay <session-id> | tail -10
   ```

5. Check subagent status:
   ```bash
   ps aux | grep -i agent | grep -v grep
   ```

---

## Scenario 2: Result Merge Conflict

**Problem:** Subagents returned conflicting results, merge failed.

**Steps:**

1. Query merge events:
   ```bash
   ledger-query --type parallel_work_failed --recent 5
   ```

2. Examine individual results:
   ```bash
   ledger-replay <session-id> | grep "agent_task_completed"
   ```

3. Compare outputs manually to understand conflict

4. Determine resolution: vote, prioritize, or manual review

---

## Scenario 3: Agent Crash

**Problem:** Subagent died mid-task.

**Steps:**

1. Check agent pool status:
   ```bash
   orchestrate --tasks '[]' --dry-run
   ```

2. Check system logs:
   ```bash
   tail -50 /var/log/system.log | grep agent
   ```

3. Replay session to find failure:
   ```bash
   ledger-replay <session-id> | grep -i "error\|fail"
   ```

4. Recovery: retry or manually continue with remaining agents

---

## Common Queries

### Find all parallel operations
```bash
ledger-query --type parallel_work_started --recent 100
```

### Find failed parallel work
```bash
ledger-query --type parallel_work_failed --recent 20
```

### Get cost breakdown per parallel operation
```bash
ledger-replay <session-id> | grep "parallel_work"
```

### Check queue depth
```bash
cat ~/.local/brain-queues/work-queue.jsonl | jq '.status' | sort | uniq -c
```
