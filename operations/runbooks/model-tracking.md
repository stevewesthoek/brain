# Model Tracking System Runbook

Real-time dynamic model detection with visibility into why each model is in use.

**Status:** Refactored 2026-04-15 — now uses Claude Code's live model payload  
**Location:** `~/.claude/` hooks + `statusline-command.sh`  
**Tracking file:** `~/.claude/model-tracking.json` (badge state only)

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

### Architecture: Ground Truth from Statusline Payload

The statusline command receives the **actual live model** from Claude Code in its stdin JSON as `.model.display_name`. This is the authoritative source — it reflects exactly which model is running at that moment.

```
statusline-command.sh (runs every prompt)
  ↓
  Reads .model.display_name from Claude Code (LIVE: haiku, sonnet, opus, etc.)
  ↓
  Normalizes to short label: "Claude Sonnet 4.6" → "sonnet"
  ↓
  Reads badge state from ~/.claude/model-tracking.json
  ↓
  Renders: [model] [badge] [agent] [context]
```

### Hook Pipeline for Badge Enrichment

Hooks update the badge state (reason, agent) to show **why** Claude Code chose that model:

**User input detection:**
```
UserPromptSubmit hook → model-tracking-hook.sh
  ↓
  Scans for: Agent(, /review, plan, /firecrawl, /gemini, /ship, etc.
  ↓
  Updates ~/.claude/model-tracking.json with reason + agent (NOT model)
```

**Agent completion detection:**
```
PostToolUse (Agent) → model-escalation-detector.sh
  ↓
  Catches when coder-default, deep-architect, cheap-prep complete
  ↓
  Updates tracking file with reason + agent
```

**Automatic reset:**
```
Stop hook → model-reset-on-stop.sh
  ↓
  Resets badge reason to "default" and agent to null
  ↓
  Model stays true (from next prompt's statusline payload)
```

### Tracking File Structure

`~/.claude/model-tracking.json` (badge state only):

```json
{
  "reason": "escalation-complexity",
  "context": "Complex multi-file refactor",
  "timestamp": "2026-04-15T10:30:45Z",
  "agent": "coder-default"
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `reason` | string | Why that badge (see Badges table above) |
| `context` | string | Human-readable task description |
| `timestamp` | ISO-8601 or null | When badge was last updated |
| `agent` | string or null | Which sub-agent spawned it |

**Note:** The `model` field is no longer stored here. It's always authoritative from Claude Code's statusline payload (`.model.display_name`).

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
# Should show: model-tracking-hook.sh registered

jq '.hooks.PostToolUse' ~/.claude/settings.json
# Should show: Agent matcher → model-escalation-detector.sh

jq '.hooks.Stop' ~/.claude/settings.json
# Should show: model-reset-on-stop.sh registered
```

### Test status line rendering

```bash
# Default Haiku state (no badge)
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Claude Haiku 4.5"}, "context_window": {"context_window_size": 200000, "used_percentage": 42}}' | bash ~/.claude/statusline-command.sh
# Output: tmp  |  haiku (200k)  |  ███░░░░░ 42%

# Sonnet with escalation badge
cat > ~/.claude/model-tracking.json <<'EOF'
{"reason": "escalation-complexity", "context": "test", "timestamp": null, "agent": "coder-default"}
EOF
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Claude Sonnet 4.6"}, "context_window": {"context_window_size": 200000, "used_percentage": 62}}' | bash ~/.claude/statusline-command.sh
# Output: tmp  |  sonnet ↑ (complex) [coder-default] (200k)  |  ████░░░░ 62%

# Opus with high-complexity badge
cat > ~/.claude/model-tracking.json <<'EOF'
{"reason": "escalation-high-complexity", "context": "test", "timestamp": null, "agent": "deep-architect"}
EOF
echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Claude Opus 4.6"}, "context_window": {"context_window_size": 200000, "used_percentage": 85}}' | bash ~/.claude/statusline-command.sh
# Output: tmp  |  opus ↑↑ (hard) [deep-architect] (200k)  |  ██████░░ 85%
```

### Inspect current tracking state

```bash
cat ~/.claude/model-tracking.json | jq .
# Should only have: reason, context, timestamp, agent (no model field)
```

---

## Troubleshooting

### Status line shows wrong model

**Root cause:** The model comes from Claude Code's statusline payload (`.model.display_name`), not from guessing or hooks. If the status line shows wrong model, Claude Code itself is reporting the wrong model. This is extremely rare.

**If it happens:**
1. Verify Claude Code is showing the right model in its UI
2. Test the statusline script with a sample payload:
   ```bash
   echo '{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Claude Sonnet 4.5"}, "context_window": {"context_window_size": 200000, "used_percentage": 50}}' | bash ~/.claude/statusline-command.sh
   ```
3. Should output: `tmp  |  sonnet (200k)  |  █████░░░ 50%`

### Badge not updating when I run an Agent

**Check 1:** Verify tracking file and hooks exist
```bash
ls -la ~/.claude/model-tracking.json ~/.claude/hooks/model-*.sh
```

**Check 2:** Verify hooks are registered
```bash
jq '.hooks' ~/.claude/settings.json | jq '.PostToolUse'
```

**Check 3:** Test the badge update manually
```bash
# Manually trigger an update
echo '{"reason": "escalation-complexity", "context": "test", "timestamp": null, "agent": "coder-default"}' > ~/.claude/model-tracking.json

# Check output
bash ~/.claude/statusline-command.sh < ~/.claude/statusline-payload-sample.json
```

### Unexpected badge reset between prompts

**Expected behavior:** Stop hook resets the badge reason to "default" when a task completes (between independent prompts).

**Why:** Badges represent transient state (we're in plan mode, running an agent, etc.). When you move to the next task, that state should reset unless the next prompt explicitly triggers a badge.

**If unwanted:** This is by design. Badges are ephemeral — they indicate the *current* mode within a task.

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
