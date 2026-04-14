# Model Tracking System Runbook

Real-time dynamic model detection with visibility into why each model is in use.

**Status:** Live since 2026-04-14  
**Location:** `~/.claude/` hooks + `statusline-command.sh`  
**Tracking file:** `~/.claude/model-tracking.json`

---

## Overview

The Claude Code model router works *under the surface* — traditionally, you never know when a task escalates from Haiku to Sonnet to Opus. This system makes it **always visible in your terminal status line** with clear reasons why.

### What You See

Your status line now dynamically displays the active model and reason:

```
brain  |  haiku                           # Default: Haiku handles everything
brain  |  sonnet ↑ (complex) [coder-default]  # Escalated due to task complexity
brain  |  opus ↑↑ (hard) [deep-architect]    # Double escalation: high blast-radius
brain  |  haiku ⊙ (plan)                     # In planning mode
brain  |  haiku ◊ (review)                    # Running /review skill
brain  |  haiku ⚙ (prep)                      # Context preprocessing
```

---

## Status Line Badges

| Badge | Reason ID | Triggered by | Meaning |
|-------|-----------|--------------|---------|
| *(none)* | `default` | Normal execution | Haiku is handling it; default cheapest tier |
| `↑` | `escalation-complexity` | Haiku struggled on complex task | Escalated to **Sonnet** for multi-file reasoning |
| `↑↑` | `escalation-high-complexity` | High blast-radius decision needed | Escalated to **Opus** (auth/migrations/prod) |
| `⊙` | `plan-mode` | EnterPlanMode invoked | Gathering info, planning architecture |
| `◊` | `review-mode` | `/review` skill or manual review | Pre-landing PR review in progress |
| `⚙` | `preprocessing-triage` | `cheap-prep` agent spawned | Haiku compressing context before main task |
| `⚙` | `preprocessing-large-context` | Gemini Flash preprocessor detected | Free-tier summarization (1M token window) |
| `🔍` | `research-mode` | `/firecrawl` or web research | Web scraping/search active |
| `⬆` | `deploy-mode` | `/ship` or `/land-and-deploy` | Deployment workflow running |

---

## How It Works

### Hook Pipeline

**User input detection:**
```
UserPromptSubmit hook → model-tracking-hook.sh
  ↓
  Scans for: Agent(, /review, plan, /firecrawl, /gemini, /ship, etc.
  ↓
  Updates ~/.claude/model-tracking.json with model + reason
```

**Agent completion detection:**
```
PostToolUse (Agent) → model-escalation-detector.sh
  ↓
  Catches when coder-default, deep-architect, cheap-prep complete
  ↓
  Updates tracking file with actual model that ran
```

**Status line refresh:**
```
statusline-command.sh (runs every prompt)
  ↓
  Reads ~/.claude/model-tracking.json
  ↓
  Renders: [model] [badge] [context]
```

**Automatic reset:**
```
Stop hook → model-reset-on-stop.sh
  ↓
  Resets to Haiku when task completes
  ↓
  Next task starts fresh at cheapest tier
```

### Tracking File Structure

`~/.claude/model-tracking.json`:

```json
{
  "model": "sonnet",
  "reason": "escalation-complexity",
  "context": "Complex multi-file refactor",
  "timestamp": "2026-04-14T10:30:45Z",
  "agent": "coder-default"
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `model` | string | Active model: `haiku`, `sonnet`, `opus`, `gemini-flash` |
| `reason` | string | Why that model (see Badges table above) |
| `context` | string | Human-readable task description |
| `timestamp` | ISO-8601 or null | When state was last updated |
| `agent` | string or null | Which sub-agent spawned it |

---

## Cost Awareness

Use the status line to stay aware of token costs as you work:

| Model | Cost vs Opus | Status line indicator |
|-------|-------------|----------------------|
| **Haiku** | ~25× cheaper | No badge or plain `haiku` |
| **Sonnet** | ~5× cheaper | `sonnet ↑ (complex)` |
| **Opus** | 1× (baseline) | `opus ↑↑ (hard)` |
| **Gemini Flash** | **FREE** | `gemini-flash ⚙ (preprocess)` |

**Routing discipline:**
1. Every task starts at **Haiku** (cheapest)
2. Escalate to **Sonnet** only if Haiku insufficient
3. Escalate to **Opus** only if Sonnet insufficient + high blast-radius
4. Use **Gemini Flash** (free) for preprocessing large context

The badges show you whether you're still in tier 1 or if escalation became necessary. If you see `↑` or `↑↑`, that means the task genuinely needed extra reasoning power.

---

## Testing the System

### Verify hooks are wired

```bash
jq '.hooks.UserPromptSubmit' ~/.claude/settings.json
# Should show: model-tracking-hook.sh in first position

jq '.hooks.PostToolUse' ~/.claude/settings.json
# Should show: Agent matcher → model-escalation-detector.sh

jq '.hooks.Stop' ~/.claude/settings.json
# Should show: model-reset-on-stop.sh in first position
```

### Test status line rendering

```bash
# Default Haiku state
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Haiku"}, "context_window": {"context_window_size": 200000, "used_percentage": 42}}' | bash ~/.claude/statusline-command.sh

# Sonnet escalation
cat > ~/.claude/model-tracking.json <<'EOF'
{"model": "sonnet", "reason": "escalation-complexity", "context": "test", "timestamp": null, "agent": "coder-default"}
EOF
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Haiku"}, "context_window": {"context_window_size": 200000, "used_percentage": 62}}' | bash ~/.claude/statusline-command.sh
```

### Inspect current tracking state

```bash
cat ~/.claude/model-tracking.json | jq .
```

---

## Troubleshooting

### Status line not showing model changes

**Check 1:** Verify tracking file exists and is readable
```bash
ls -la ~/.claude/model-tracking.json
cat ~/.claude/model-tracking.json | jq .
```

**Check 2:** Verify hooks are registered in settings.json
```bash
jq '.hooks' ~/.claude/settings.json | grep -A2 UserPromptSubmit
```

**Check 3:** Test the statusline script directly
```bash
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Haiku"}, "context_window": {"context_window_size": 200000, "used_percentage": 50}}' | bash ~/.claude/statusline-command.sh
```

### Tracking shows wrong model after escalation

**Cause:** PostToolUse hook for Agent tool didn't fire (detection pattern mismatch)  
**Fix:** Edit `model-escalation-detector.sh` to match your Agent invocation pattern

### Status line resets when you don't expect it

**Cause:** Stop hook runs on every prompt end  
**Expected:** Model resets to Haiku between independent tasks (by design)  
**If unwanted:** Modify `model-reset-on-stop.sh` to be more selective

---

## Files

| File | Purpose | Managed by |
|------|---------|-----------|
| `~/.claude/model-tracking.json` | Current model + reason state | Hooks |
| `~/.claude/statusline-command.sh` | Renders status line with tracking | User edits |
| `~/.claude/hooks/model-tracking-hook.sh` | Detects mode from user input | User edits |
| `~/.claude/hooks/model-escalation-detector.sh` | Detects Agent escalations | User edits |
| `~/.claude/hooks/model-reset-on-stop.sh` | Resets to Haiku on Stop | User edits |
| `~/.claude/settings.json` | Registers hooks in UserPromptSubmit/PostToolUse/Stop | User edits |

---

## Integration with Model Router

This system works **alongside** the automatic model router (`/model-router` skill):

- **Router logic:** Decides which model to use based on task complexity
- **Tracking system:** Makes that decision **visible** in your terminal

They're independent:
- Router can escalate without user knowing
- Tracking makes it immediately visible
- Status line is your cost accountability tool

---

## Future Enhancements

- [ ] Log model changes to decision-log.md for retrospective analysis
- [ ] Alert when cost exceeds threshold (e.g., "Opus running for 5min+")
- [ ] Integration with billing APIs to show real-time cost
- [ ] Per-project model budgets (e.g., "brain repo: max Sonnet")

---

## Related Files

- **Policy:** `brain/ai/policy/routing.md` (canonical source of truth)
- **Config:** `~/.claude/settings.json` (hooks wired here)
- **Status line:** `~/.claude/statusline-command.sh` (display logic)
- **Guide:** `~/.claude/MODEL_TRACKING_GUIDE.md` (user-facing reference)
