# Plan: Robust Model Tracking via Statusline Payload

## Context

The current model tracking system shows the wrong model in the status line because it guesses the model by parsing user input text (`model-tracking-hook.sh`) or grepping tool output (`model-escalation-detector.sh`). Neither approach is reliable — pattern matching misses real switches, and hooks never receive the actual model being used.

The fix is a pivot: the statusline command already receives the **actual live model** in its stdin payload as `.model.display_name` (e.g. `"Claude Haiku 4.5"`). The current `statusline-command.sh` ignores this field entirely and reads from the stale `model-tracking.json` instead.

**Goal:** Status line always shows the true current model, with badge enrichment (plan/review/deploy/etc.) still working correctly.

---

## Root Cause

`statusline-command.sh` reads model from `model-tracking.json` (stale, guessed) instead of `.model.display_name` in the live stdin payload (always correct).

---

## Implementation Plan

### 1. Fix `statusline-command.sh` — read live model from payload (primary fix)

**File:** `/Users/Office/.claude/statusline-command.sh`

- Change model source: read `.model.display_name` from stdin payload (already available)
- Normalize `display_name` → short label: `"Claude Haiku 4.5"` → `haiku`, `"Claude Sonnet 4.5"` → `sonnet`, `"Claude Opus 4.5"` → `opus`  
- Keep reading `reason` and `agent` from `model-tracking.json` (still used for badge enrichment only)
- If `.model.display_name` is empty/null, fall back to `model-tracking.json` model field

```sh
# New logic (replaces the tracking file read for model):
live_model_raw=$(echo "$input" | jq -r '.model.display_name // empty')
# Normalize to short name
active_model=$(echo "$live_model_raw" | sed 's/Claude //' | awk '{print tolower($1)}')
# active_model is now "haiku", "sonnet", "opus", etc.

# Still read reason+agent from tracking file for badges
reason=$(jq -r '.reason // "default"' "$tracking_file" 2>/dev/null)
agent=$(jq -r '.agent // null' "$tracking_file" 2>/dev/null)
```

### 2. Simplify `model-tracking-hook.sh` — only update reason/agent, not model

**File:** `/Users/Office/.claude/hooks/model-tracking-hook.sh`

- Remove all `update_model` calls that set the `model` field (that's now authoritative from the payload)
- Keep only updating `reason` and `agent` in the tracking file
- Also store a `session_id` from the hook input to detect new sessions
- The tracking file now only contains: `reason`, `agent`, `context`, `timestamp`

### 3. Simplify `model-escalation-detector.sh` — only update reason/agent

**File:** `/Users/Office/.claude/hooks/model-escalation-detector.sh`

- Same change: don't set `model` field, only `reason` and `agent`

### 4. Fix `model-reset-on-stop.sh` — only reset reason, not model

**File:** `/Users/Office/.claude/hooks/model-reset-on-stop.sh`

- Only reset `reason` → `"default"` and `agent` → `null`
- Remove `model` field from the reset write (the live payload will show the real model)

---

## Tracking File — Updated Schema

`~/.claude/model-tracking.json` becomes badge-only state:

```json
{
  "reason": "default",
  "context": "",
  "timestamp": "2026-04-15T...",
  "agent": null
}
```

The `model` field is removed — it was only ever an approximation and is no longer needed.

---

## Normalization Map

| `display_name` substring | Short label |
|--------------------------|-------------|
| `Haiku` | `haiku` |
| `Sonnet` | `sonnet` |
| `Opus` | `opus` |
| `Gemini` | `gemini` |
| anything else | lowercased first word after "Claude " |

---

## Files to Modify

1. `/Users/Office/.claude/statusline-command.sh` — primary fix
2. `/Users/Office/.claude/hooks/model-tracking-hook.sh` — strip model writes
3. `/Users/Office/.claude/hooks/model-escalation-detector.sh` — strip model writes
4. `/Users/Office/.claude/hooks/model-reset-on-stop.sh` — strip model from reset
5. `/Users/Office/.claude/model-tracking.json` — remove `model` field

---

## Verification

1. Check statusline renders correctly: `echo '{"model":{"display_name":"Claude Sonnet 4.5"},...}' | bash ~/.claude/statusline-command.sh`
2. Switch model via `/model haiku` then `/model sonnet` — status line should update immediately on next prompt
3. Status line in default session should show `haiku` without any badge
4. Escalate to a Plan agent → badge should show `⊙ (plan)`
5. Run Stop hook → reason resets to default, but model still reflects actual live model
