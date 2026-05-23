# Model Tracking Quick Start

**TL;DR: Your status line now shows which AI model is running and why, in real-time.**

---

## What You See

```
brain | sonnet ↑ (complex) [coder-default] (200k) | ▓▓▓░░░░░ 42%
```

- **sonnet** — Active model (Haiku/Sonnet/Opus/Gemini-Flash)
- **↑** — Reason badge (↑ = escalation, ↑↑ = hard, ⊙ = plan, ◊ = review, etc.)
- **(complex)** — Why that model (escalation reason)
- **[coder-default]** — Sub-agent that triggered it
- **42%** — Context window usage

---

## Reason Badges Reference

| Badge | Triggered by | Meaning | Cost |
|-------|--------------|---------|------|
| *(none)* | Normal work | Haiku handling it | Baseline |
| `↑` | Task too complex | Escalated to Sonnet | 5× higher |
| `↑↑` | High risk (auth/migrations/prod) | Escalated to Opus | 25× higher |
| `⊙` | Entering plan mode | Gathering info, designing | Baseline |
| `◊` | `/review` skill | PR review mode | Baseline |
| `⚙` | `cheap-prep` or Gemini Flash | Context preprocessing | Baseline or FREE |
| `🔍` | `/firecrawl` web research | Web scraping active | Baseline |
| `⬆` | `/ship` or `/land-and-deploy` | Deployment workflow | Baseline |

---

## Example Task Flows

### Flow 1: Simple feature (stays Haiku)

```
Start task
↓
brain | haiku                           ← Default cheapest tier
↓
Complete task
↓
(Reset to haiku)
```

**Cost:** 1× baseline

---

### Flow 2: Complex refactor (escalates to Sonnet)

```
Start task
↓
brain | haiku                           ← Begin with Haiku
↓
Hit complexity (multi-file scope)
↓
Spawn Agent (coder-default)
↓
brain | sonnet ↑ (complex) [coder-default]  ← Escalated
↓
Agent completes
↓
(Reset to haiku)
```

**Cost:** ~1 + 5 = 6× baseline

---

### Flow 3: Auth refactor (escalates to Opus)

```
Start task
↓
brain | haiku ⊙ (plan)                  ← Plan mode
↓
Gather info about auth system
↓
Complexity is high + high blast-radius
↓
Spawn Agent (coder-default)
↓
brain | sonnet ↑ (complex) [coder-default]  ← First escalation
↓
Task still risky (compliance concern)
↓
Spawn Agent (deep-architect)
↓
brain | opus ↑↑ (hard) [deep-architect]     ← Second escalation
↓
Agent completes
↓
(Reset to haiku)
```

**Cost breakdown:**
- Plan phase: 1×
- Sonnet escalation: 5×
- Opus escalation: 25×
- **Total:** ~31× baseline

**Why it's worth it:** Auth is high-risk. The extra cost is justified.

---

## Cost Awareness

### Model Pricing Hierarchy

```
Gemini Flash:     FREE (1M context window) ← Use liberally
Haiku:            1× (baseline)             ← Default tier
Sonnet:           5× (multi-file work)      ← Escalate if Haiku insufficient
Opus:             25× (high stakes)         ← Escalate if Sonnet insufficient
```

### Your Status Line as a Cost Signal

```
brain | haiku                  = Cheap ✓
brain | sonnet ↑              = More expensive, but needed
brain | opus ↑↑               = Very expensive, high stakes
```

By checking your status line, you immediately know:
1. Whether you're in baseline cost tier (Haiku)
2. If you've escalated, what triggered it (↑ vs ↑↑)
3. Which agent caused escalation

---

## Common Tasks & Their Models

| Task | Typical Model | Why |
|------|---------------|-----|
| Add a button | Haiku | Simple, isolated change |
| Fix a small bug | Haiku | Usually straightforward |
| Refactor a component | Haiku or Sonnet | Depends on scope |
| Rewrite auth | Opus | High blast-radius + compliance |
| Database migration | Opus | Data loss risk |
| API integration | Haiku or Sonnet | Depends on complexity |
| Architecture design | Haiku (plan) then Sonnet/Opus | Plan at Haiku, escalate if needed |
| Code review | Haiku (via `/review`) | Review is lean, baseline cost |
| Web research | Haiku (via `/firecrawl`) | Research is baseline, Gemini Flash for bulk |

---

## Manual Testing

### Check current model state
```bash
cat ~/.claude/model-tracking.json | jq .
```

### Validate system is working
```bash
bash ~/.claude/validate-model-tracking.sh
```

### Test rendering a specific model in status line
```bash
# Set to Sonnet escalation
echo '{"model":"sonnet","reason":"escalation-complexity","agent":"coder-default"}' > ~/.claude/model-tracking.json

# Render status line
echo '{"workspace":{"current_dir":"/tmp"},"model":{"display_name":"Haiku"},"context_window":{"context_window_size":200000,"used_percentage":42}}' | bash ~/.claude/statusline-command.sh

# Should show: sonnet ↑ (complex) [coder-default]
```

---

## Integration with Your Workflow

### During task work:
- Look at status line to know which model is active
- Badges tell you if expensive models kicked in and why
- Plan your escalations consciously (don't over-escalate)

### Between tasks:
- Model resets to Haiku automatically (Stop hook)
- Next independent task starts fresh at cheapest tier
- No need to manually reset anything

### For post-mortems:
- Decision log documents this system (see `operations/decision-log.md`)
- Runbook explains ops details (`operations/runbooks/model-tracking.md`)
- Reference guide covers user questions (`docs/model-tracking-reference.md`)

---

## Documentation Map

| Document | Purpose |
|----------|---------|
| `~/.claude/MODEL_TRACKING_GUIDE.md` | Local quick reference |
| `operations/runbooks/model-tracking.md` | Full operational guide (how it works, troubleshooting) |
| `docs/model-tracking-reference.md` | User-facing reference (quick start, cost implications) |
| `operations/model-tracking-visual-guide.md` | System architecture, hook pipeline, state flows |
| `operations/decision-log.md` | Why this system was built (decision entry) |
| `CLAUDE.md` | Updated with model tracking section |

---

## Troubleshooting

### Status line not showing model changes

**Check 1:** Verify tracking file exists
```bash
ls -la ~/.claude/model-tracking.json
```

**Check 2:** Test status line script directly
```bash
echo '{"workspace":{"current_dir":"/tmp"},"model":{"display_name":"Haiku"},"context_window":{"context_window_size":200000,"used_percentage":50}}' | bash ~/.claude/statusline-command.sh
```

**Check 3:** Verify hooks are registered
```bash
jq '.hooks.UserPromptSubmit' ~/.claude/settings.json | grep model-tracking-hook
```

### Tracking shows wrong model after escalation

**Cause:** PostToolUse hook didn't detect Agent completion  
**Fix:** Inspect `~/.claude/model-escalation-detector.sh` and verify the grep patterns match your Agent output

### Model doesn't reset after stopping task

**Cause:** Stop hook didn't fire properly  
**Fix:** Manually reset by running `bash ~/.claude/hooks/model-reset-on-stop.sh`

---

## What's Next?

Just start working — the system works automatically in the background:

1. **Look at your status line** to see which model is active
2. **Notice the reason badges** to understand why each model was chosen
3. **Use this info** to learn which tasks are naturally complex
4. **Plan accordingly** — if you know a task is risky (auth, migrations), you can pre-plan for Opus

The system is completely transparent and requires zero user action. It's just there, showing you real-time cost signals.

---

## See Also

- `brain/ai/policy/routing.md` — Routing policy (how router decides which model)
- `brain/ai/policy/guardrails.md` — Safety policy
- `brain/ai/policy/routing.md` — Shared routing policy reference
