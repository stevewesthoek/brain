# Ledger Forensic Debugging Runbook

**Date:** 2026-05-22  
**Audience:** Developers, Operations  
**Purpose:** Debug agent behavior using append-only ledger

---

## Scenario 1: Agent Chose Wrong Model

**Problem:** Agent escalated from Haiku to Sonnet when it should have stayed on Haiku. Cost spike.

**Steps:**

1. Find the escalation event:
   ```bash
   ledger-query --type model_escalation --recent 20 --format table
   ```

2. Replay the session to see context:
   ```bash
   ledger-replay <session-id> --detailed | grep -A2 "model_escalation"
   ```

3. Read the justification:
   ```bash
   ledger-query --type model_escalation --recent 1 | jq '.payload.justification'
   ```

4. Evaluate: Was the decision reasonable given context? Or is there a bug in escalation logic?

---

## Scenario 2: Tool Call Failed

**Problem:** Agent invoked Bash, command failed, agent didn't handle error gracefully.

**Steps:**

1. List recent errors:
   ```bash
   ledger-query --type error_encountered --recent 20
   ```

2. Examine the tool call before the error:
   ```bash
   ledger-replay <session-id> --detailed | grep -B3 "error_encountered"
   ```

3. Check tool result:
   ```bash
   ledger-replay <session-id> | grep -A1 "tool_result"
   ```

4. Evaluate: Did agent handle error gracefully or let it propagate?

---

## Scenario 3: Cost Spike

**Problem:** Session cost was $3.50 instead of expected $0.50.

**Steps:**

1. Generate cost report:
   ```bash
   ledger-report --type costs --days 1
   ```

2. Check for escalations:
   ```bash
   ledger-query --type model_escalation --recent 50
   ```

3. Count tool calls by session:
   ```bash
   ledger-query --type tool_call | jq '.sessionId' | sort | uniq -c
   ```

4. Identify the expensive session and replay it:
   ```bash
   ledger-replay <expensive-session-id>
   ```

---

## Scenario 4: Session Hung or Timed Out

**Problem:** Agent never finished task.

**Steps:**

1. Check if session ended:
   ```bash
   ledger-query --type session_end --recent 10
   ```

2. If no end event, replay last 100 events from session:
   ```bash
   ledger-replay <session-id> | tail -20
   ```

3. Look for approval_requested (may be waiting for human):
   ```bash
   ledger-replay <session-id> | grep "approval_requested"
   ```

4. Evaluate: Is agent genuinely stuck, or waiting for approval?

---

## Common Queries

### Find all failed tool calls
```bash
ledger-query --type tool_result --format json | jq '.entries | map(select(.payload.success == false))'
```

### Find all approvals granted
```bash
ledger-query --type approval_granted --recent 50
```

### Show timeline of decisions in a session
```bash
ledger-replay <session-id> | grep "decision"
```

### Get total cost for a session
```bash
ledger-replay <session-id> | grep "session_end" | jq '.payload.total_cost'
```

---

## Recovery Procedures

### Corruption Detection

If ledger file is corrupted (JSON parse errors):

1. Back up current ledger:
   ```bash
   cp ~/.local/brain-ledger/ledger.jsonl ~/.local/brain-ledger/ledger.jsonl.bak
   ```

2. Attempt to repair (remove malformed lines):
   ```bash
   grep -v '^{$' ~/.local/brain-ledger/ledger.jsonl > /tmp/ledger-clean.jsonl
   while IFS= read -r line; do
     if jq -e . >/dev/null 2>&1 <<< "$line"; then
       echo "$line" >> /tmp/ledger-repaired.jsonl
     fi
   done < /tmp/ledger-clean.jsonl
   mv /tmp/ledger-repaired.jsonl ~/.local/brain-ledger/ledger.jsonl
   ```

3. Verify repair:
   ```bash
   ledger-report --type audit
   ```

### Ledger Rotation

If ledger grows too large (>100MB):

1. Archive current ledger:
   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   mv ~/.local/brain-ledger/ledger.jsonl ~/.local/brain-ledger/ledger.${TIMESTAMP}.jsonl
   gzip ~/.local/brain-ledger/ledger.${TIMESTAMP}.jsonl
   ```

2. Start fresh ledger (next write will create new file):
   ```bash
   # No action needed — next ledger write auto-creates
   ledger-write --type session_start --session sess_new --agent claude-code --payload '{"start":true}'
   ```

3. Archive retention: keep last 10 rotations, compress older ones
