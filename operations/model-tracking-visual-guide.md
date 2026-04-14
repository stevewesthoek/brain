# Model Tracking System — Visual Guide

**Complete system map showing how all components connect and work together.**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         YOUR STATUS LINE (Real-time)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  brain  |  sonnet ↑ (complex) [coder-default] (200k)  |  ▓▓▓░░░░░ 42%    │
│                                                                              │
│  ├─ Folder name (clickable)                                                │
│  ├─ MODEL + BADGE + REASON + AGENT (from tracking file)                    │
│  └─ Context window usage                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                    ┌───────────────┼───────────────┐
                    │               │               │
                    │         (Every prompt)        │
                    │               │               │
                    ▼               ▼               ▼
        ┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
        │ Your Prompt     │  │  Hooks      │  │ Tracking File   │
        │ (user input)    │  │  Execute    │  │ (JSON state)    │
        └─────────────────┘  └─────────────┘  └─────────────────┘
                    ▲               │               ▲
                    │               ▼               │
                    │  ┌──────────────────────────┐ │
                    │  │ model-tracking-hook.sh   │ │
                    │  │                          │ │
                    │  │ Scans your input for:    │ │
                    │  │ • Agent(...)             │ │
                    │  │ • /review                │ │
                    │  │ • EnterPlanMode          │ │
                    │  │ • /firecrawl             │ │
                    │  │ • /gemini                │ │
                    │  │ • /ship                  │ │
                    │  │                          │ │
                    │  │ Updates tracking.json    │ │
                    │  │ with detected mode       │ │
                    │  └──────────────────────────┘ │
                    │               │               │
                    │               └───────────────┘
                    │
                    └─────────────────────────────────┘
                   (UserPromptSubmit hook fires)
```

---

## Hook Pipeline

### 1. UserPromptSubmit Hook (on every prompt)

```
User types prompt
       ↓
settings.json detects UserPromptSubmit
       ↓
model-tracking-hook.sh runs
       ↓
Scans prompt for keywords:
   ├─ Agent( → detect subagent_type (cheap-prep, coder-default, deep-architect)
   ├─ /review → set reason = "review-mode"
   ├─ EnterPlanMode → set reason = "plan-mode"
   ├─ /firecrawl → set reason = "research-mode"
   ├─ /gemini → set reason = "preprocessing-large-context"
   └─ /ship → set reason = "deploy-mode"
       ↓
Update ~/.claude/model-tracking.json
       ↓
Status line reads tracking file
       ↓
Renders: model + badge + reason + agent
```

### 2. PostToolUse Hook (Agent tool completes)

```
Agent tool completes (e.g., coder-default finished)
       ↓
settings.json detects PostToolUse (matcher: Agent)
       ↓
model-escalation-detector.sh runs
       ↓
Parses tool result for:
   ├─ subagent_type.*deep-architect → opus ↑↑
   ├─ subagent_type.*coder-default → sonnet ↑
   ├─ subagent_type.*cheap-prep → haiku (prep)
   └─ gemini-flash → gemini-flash ⚙
       ↓
Update ~/.claude/model-tracking.json
       ↓
Status line updates in real-time
```

### 3. Stop Hook (task ends)

```
User clicks Stop
       ↓
settings.json detects Stop
       ↓
model-reset-on-stop.sh runs
       ↓
Reset ~/.claude/model-tracking.json to:
   {
     "model": "haiku",
     "reason": "default",
     ...
   }
       ↓
Next task starts fresh at Haiku (cheapest tier)
```

---

## Tracking File States

The tracking file evolves through a task's lifecycle:

```
START OF TASK
│
├─ Default state (Haiku)
│  {
│    "model": "haiku",
│    "reason": "default",
│    "context": "",
│    "timestamp": null,
│    "agent": null
│  }
│
├─ User enters plan mode
│  {
│    "model": "haiku",
│    "reason": "plan-mode",
│    "context": "Designing fala app architecture",
│    "timestamp": "2026-04-14T10:40:15Z",
│    "agent": null
│  }
│
├─ User spawns Agent (coder-default)
│  {
│    "model": "sonnet",
│    "reason": "escalation-complexity",
│    "context": "Complex multi-file refactor",
│    "timestamp": "2026-04-14T10:50:32Z",
│    "agent": "coder-default"
│  }
│
└─ User stops task
   {
     "model": "haiku",
     "reason": "default",
     "context": "",
     "timestamp": null,
     "agent": null
   }

END OF TASK → Next task starts fresh
```

---

## Status Line Evolution During a Task

### Scenario: Fix a bug, hit complexity, escalate to Sonnet

```
Time  | User Action            | Tracking State              | Status Line Display
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T0    | Start task             | haiku, default              | brain | haiku (200k) | ░░░░░░░ 5%
      | "Fix auth bug"         |                             |
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T1    | Start investigating    | haiku, default              | brain | haiku (200k) | ░░░░░░░ 12%
      | Haiku explores the bug |                             |
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T2    | Realize it's complex   | haiku, default              | brain | haiku (200k) | ░░░░░░░ 18%
      | (multi-service issue)  |                             |
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T3    | Spawn Agent            | sonnet, escalation-complex  | brain | sonnet ↑ (complex)      │
      | coder-default          | [coder-default]             | [coder-default] (200k) | ░░░░░░░ 35%
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T4    | Agent running          | sonnet, escalation-complex  | brain | sonnet ↑ (complex)      │
      |                        | [coder-default]             | [coder-default] (200k) | ▓░░░░░░ 48%
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T5    | Agent returns fix      | sonnet, escalation-complex  | brain | sonnet ↑ (complex)      │
      |                        | [coder-default]             | [coder-default] (200k) | ▓▓░░░░░ 52%
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T6    | Review fix locally     | haiku, default              | brain | haiku (200k) | ▓▓░░░░░ 52%
      | Fix looks good         |                             |
──────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────
T7    | Stop task              | haiku, default              | brain | haiku (200k) | ░░░░░░░ 0%
      | Reset for next task    |                             | (reset on Stop hook)
──────┴────────────────────────┴─────────────────────────────┴──────────────────────────────────
```

**Key insight:** You see the escalation happen in real-time (T3) and know exactly why (↑ complex). When the Agent finishes (T5), you have the result and can review. Reset (T7) happens automatically.

---

## Cost Tracking Example

### Task 1: Fix a small feature (stays at Haiku)

```
┌────────────────────────────────────────────┐
│ Task 1: Add login button                  │
├────────────────────────────────────────────┤
│ brain | haiku                              │
│ brain | haiku                              │
│ brain | haiku                              │
│ brain | haiku (200k) | ▓░░░░░░ 25%        │
├────────────────────────────────────────────┤
│ Cost: 1× Haiku baseline                   │
│ Result: ✓ Completed                       │
│ Next: Reset to Haiku                      │
└────────────────────────────────────────────┘
```

### Task 2: Refactor auth system (escalates to Sonnet, then Opus)

```
┌────────────────────────────────────────────────────┐
│ Task 2: Refactor auth middleware                   │
├────────────────────────────────────────────────────┤
│ brain | haiku              (planning)              │
│ brain | haiku ⊙ (plan)     (gathering info)        │
│ brain | sonnet ↑ (complex) (multi-file changes)    │
│ brain | opus ↑↑ (hard)     (compliance check)      │
│ brain | opus ↑↑ (hard) (200k) | ▓▓▓▓▓░░ 72%       │
├────────────────────────────────────────────────────┤
│ Cost breakdown:                                    │
│   Haiku (planning): 1×                            │
│   Sonnet (complex): 5×                            │
│   Opus (hard): 25×                                │
│ Total: ~1 + 5 + 25 = 31× a single Haiku task     │
│                                                   │
│ Result: ✓ Completed                              │
│ Reason: Auth is high-blast-radius (necessary)    │
│ Next: Reset to Haiku                             │
└────────────────────────────────────────────────────┘
```

**Insight:** The status line made the cost journey visible. You paid 31× but knew exactly why (auth compliance) and could justify it.

---

## File Map

```
~/.claude/
├── model-tracking.json                    ← Tracking state (updated by hooks)
├── statusline-command.sh                  ← Renders status line (reads tracking)
├── settings.json                          ← Hook registration (UserPromptSubmit, PostToolUse, Stop)
├── MODEL_TRACKING_GUIDE.md                ← Local quick reference
├── validate-model-tracking.sh             ← Validation script (12/12 checks)
└── hooks/
    ├── model-tracking-hook.sh             ← UserPromptSubmit: detects user intent
    ├── model-escalation-detector.sh       ← PostToolUse (Agent): detects escalations
    └── model-reset-on-stop.sh             ← Stop: resets to Haiku

brain/
├── CLAUDE.md                              ← Updated with model tracking section
├── operations/runbooks/model-tracking.md  ← Full operational guide
├── docs/model-tracking-reference.md       ← User-facing reference
├── operations/system-configs/claude/
│   └── validate-model-tracking.sh         ← Same as ~/.claude/ (symlinked)
└── operations/model-tracking-visual-guide.md  ← This file

Auto-memory:
└── .claude/projects/.../memory/
    ├── project_model_tracking.md          ← Project status
    └── MEMORY.md                          ← Index (updated)
```

---

## Testing Each Hook

### Test UserPromptSubmit hook

```bash
# Create a mock input
cat > /tmp/test-input.txt <<'EOF'
User: I'm going to spawn an Agent for this complex refactor.

---
EOF

# Run the hook
cat /tmp/test-input.txt | bash ~/.claude/hooks/model-tracking-hook.sh

# Check tracking file
cat ~/.claude/model-tracking.json | jq .
# Expected: Should detect Agent mention (if pattern matches)
```

### Test PostToolUse hook (Agent)

```bash
# Create mock agent output
cat > /tmp/test-agent-output.txt <<'EOF'
{
  "tool": "Agent",
  "subagent_type": "coder-default",
  "result": "Complex multi-file task completed"
}
EOF

# Run the hook
cat /tmp/test-agent-output.txt | bash ~/.claude/hooks/model-escalation-detector.sh

# Check tracking file
cat ~/.claude/model-tracking.json | jq .
# Expected: model="sonnet", reason="escalation-complexity", agent="coder-default"
```

### Test Stop hook

```bash
# Run the reset hook
bash ~/.claude/hooks/model-reset-on-stop.sh

# Check tracking file
cat ~/.claude/model-tracking.json | jq .
# Expected: Reset to default (haiku, default, empty context, no agent)
```

### Test status line rendering

```bash
# Create mock harness data
cat > /tmp/test-harness.json <<'EOF'
{
  "workspace": {"current_dir": "/Users/Office/Repos/stevewesthoek/brain"},
  "model": {"display_name": "Haiku"},
  "context_window": {"context_window_size": 200000, "used_percentage": 42}
}
EOF

# Render with default state
echo '{"model": "haiku", "reason": "default", "agent": null}' > ~/.claude/model-tracking.json
cat /tmp/test-harness.json | bash ~/.claude/statusline-command.sh

# Render with escalation state
echo '{"model": "sonnet", "reason": "escalation-complexity", "agent": "coder-default"}' > ~/.claude/model-tracking.json
cat /tmp/test-harness.json | bash ~/.claude/statusline-command.sh

# Expected: Status line shows correct model, badge, agent
```

---

## Integration Checklist

✓ Hooks wired in `~/.claude/settings.json`:
  - UserPromptSubmit: model-tracking-hook.sh (first)
  - PostToolUse (Agent): model-escalation-detector.sh
  - Stop: model-reset-on-stop.sh (first)

✓ Status line script updated to read tracking file

✓ Validation script passes all 12 checks: `bash ~/.claude/validate-model-tracking.sh`

✓ Documentation complete:
  - Runbook (operations/runbooks/model-tracking.md)
  - Reference (docs/model-tracking-reference.md)
  - Local guide (~/.claude/MODEL_TRACKING_GUIDE.md)
  - This visual guide (operations/model-tracking-visual-guide.md)

✓ Memory system updated:
  - project_model_tracking.md created
  - MEMORY.md index updated

✓ CLAUDE.md updated with model tracking section

✓ Committed to brain repo

---

## Decision Log Entry

See: `operations/decision-log.md` → "Model Tracking System" section

Decision: Implement real-time model visibility in status line
Rationale: Model router works invisibly; users had no way to know when expensive models (Sonnet/Opus) were running or why. This system makes routing decisions transparent.
Trade-offs: Minimal overhead (just reading/writing JSON file); no performance impact.
Outcome: Users can now see cost signals in real-time and understand model router's decisions.

---

## See Also

- **Routing Policy:** `brain/ai/policy/routing.md` (how router decides)
- **Safety Policy:** `brain/ai/policy/guardrails.md` (authorization rules)
- **Decision Log:** `operations/decision-log.md`
