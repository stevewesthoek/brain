# Model Tracking Reference

Quick reference for understanding Claude Code model tracking in your status line.

---

## At a Glance

Your Claude Code status line now shows which model is running and why:

```
brain  |  sonnet ↑ (complex) [coder-default]  |  ▓▓▓░░░░░ 35%
        └─────────┬──────────────────────────┘
           Dynamic model tracking
```

**What it tells you:**
- **sonnet** — Actual model running (started at Haiku, escalated)
- **↑** — Reason badge (escalation due to complexity)
- **(complex)** — Contextual reason tag
- **[coder-default]** — Sub-agent that spawned it
- **35%** — Context window usage (unchanged)

---

## Why This Matters

The model router in Claude Code makes routing decisions *automatically and invisibly*:

```
Task arrives → Router decides → Model escalates
                  ↓
          You had no idea
              
         (Traditional)
```

**With model tracking:**

```
Task arrives → Router decides → Model escalates
                  ↓                     ↓
          Status line updates    You see it in real-time
              
         (Now transparent)
```

**Why transparency is valuable:**
- **Cost awareness:** See when expensive models are needed
- **Learning:** Understand which tasks need Opus vs Sonnet vs Haiku
- **Accountability:** Know why a task cost what it cost
- **Debugging:** Identify tasks that might be solvable at cheaper tiers

---

## Reason Badges Quick Reference

| Badge | Meaning | Model | Cost |
|-------|---------|-------|------|
| *(none)* | Default operation | Haiku | Baseline |
| `↑` | Task too complex for Haiku | Sonnet | 5× higher |
| `↑↑` | High blast-radius (auth/prod/migrations) | Opus | 25× higher |
| `⊙` | Planning/architecture phase | Haiku | Baseline |
| `◊` | Code review (`/review` skill) | Haiku | Baseline |
| `⚙` | Preprocessing/context compression | Haiku or Gemini | Baseline or FREE |
| `🔍` | Web research (`/firecrawl`) | Haiku | Baseline |
| `⬆` | Deployment (`/ship`, `/land-and-deploy`) | Haiku | Baseline |

**Key insight:** Most badges are *informational* (planning, review, research). The escalation badges (`↑`, `↑↑`) signal **actual cost increases** and are worth paying attention to.

---

## When Models Escalate

**Haiku → Sonnet** (`↑`):
- Multi-file refactoring or architectural changes
- Complex logic that needs broader reasoning
- API integrations or tricky data flow
- Haiku produced insufficient output in first attempt

**Sonnet → Opus** (`↑↑`):
- Authentication or authorization logic
- Database migrations or schema changes
- Data loss risks or compliance-critical code
- Previous escalation (Haiku→Sonnet) was still insufficient
- High blast-radius decisions affecting many systems

**Any → Gemini Flash** (`⚙` preprocessing):
- Large input (>100k tokens of logs, docs, code)
- Need to summarize bulk data before main reasoning
- FREE tier preprocessing before Haiku/Sonnet analysis

---

## Tracking Data

The system stores current model state in `~/.claude/model-tracking.json`:

```json
{
  "model": "sonnet",                          // Active model
  "reason": "escalation-complexity",          // Why it's running
  "context": "Multi-file auth refactor",      // Task description
  "timestamp": "2026-04-14T10:30:45Z",        // When state changed
  "agent": "coder-default"                    // Sub-agent that ran it
}
```

**You can inspect anytime:**
```bash
cat ~/.claude/model-tracking.json | jq .
```

**State persists** during a multi-turn task, then **resets to Haiku** when you run `/Stop`.

---

## Cost Implications

### Token Cost Ratios (Rough)

| Model | Input tokens | Output tokens | When escalate? |
|-------|--------------|---------------|----------------|
| Haiku | 1× | 1× | Always start here |
| Sonnet | ~5× | ~3× | Haiku insufficient |
| Opus | ~25× | ~10× | Sonnet insufficient + high blast-radius |
| Gemini Flash | FREE | FREE (1M ctx) | For preprocessing large inputs |

### Example: A Task's Cost Journey

**Task:** "Refactor the auth middleware"

```
1. Start with Haiku
   → Produces basic refactor, but misses edge cases
   → Status line: haiku (no badge)
   → Cost: baseline
   
2. Escalate to Sonnet (you see ↑)
   → Handles multi-file implications, but auth is risky
   → Status line: sonnet ↑ (complex)
   → Cost: 5× higher
   
3. Escalate to Opus (you see ↑↑)
   → Deep review of compliance/security implications
   → Status line: opus ↑↑ (hard)
   → Cost: 25× higher
   
Total cost: ~1 + 5 + 25 = 31× a single Haiku task
(But necessary for compliance-critical code)
```

The status line lets you see this journey in real-time.

---

## Integration Points

### With `/review` skill
- Running `/review` sets reason to `review-mode`
- Model stays at Haiku (you pay baseline, not escalation)
- Status line shows: `haiku ◊ (review)`

### With `/model-router` skill
- Router makes escalation decisions automatically
- Tracking system makes those decisions **visible**
- Status line shows when router escalated you

### With plan mode
- Entering plan mode sets reason to `plan-mode`
- Status line shows: `haiku ⊙ (plan)`
- No cost increase (still Haiku)

### With `/firecrawl` or web research
- Scraping sets reason to `research-mode`
- Status line shows: `haiku 🔍 (research)`
- No cost increase (still Haiku)

---

## Interpreting Your Status Line

**Scenario 1: Building a simple feature**
```
brain | haiku (200k) | ▓░░░░░░ 12%
```
→ All good; task is straightforward, Haiku is handling it efficiently.

**Scenario 2: Fixing a bug but hit complexity**
```
brain | sonnet ↑ (complex) [coder-default] (200k) | ▓▓▓▓░░░ 58%
```
→ Router escalated because the bug was more complex than expected. That's fine — you're paying 5× but for good reason.

**Scenario 3: Doing infrastructure work**
```
brain | opus ↑↑ (hard) [deep-architect] (200k) | ▓▓▓▓▓░░ 72%
```
→ High blast-radius task (infrastructure, migrations). Opus is justified. Context is getting full; consider breaking up.

**Scenario 4: In planning mode**
```
brain | haiku ⊙ (plan) (200k) | ▓░░░░░░ 15%
```
→ Still gathering information and designing approach. No escalation yet; baseline cost. Once you start implementation, might escalate.

---

## Model Tracking vs The Router

Two separate systems working together:

| System | Role | Visibility |
|--------|------|-----------|
| **Model Router** | Decides which model to use based on task complexity | Invisible (backend logic) |
| **Model Tracking** | Makes that decision visible in your status line | Visible (real-time display) |

- Router works automatically — you don't invoke it
- Tracking makes router's decisions transparent
- Status line is your window into the router's thinking

---

## Troubleshooting

**Q: Why does the status line still show "haiku" when I know I escalated?**

A: The tracking file might not have been updated. Check:
```bash
cat ~/.claude/model-tracking.json
```

If it shows Haiku but you were working on a complex task, the Agent hook may not have fired correctly. Restart Claude Code and try again.

**Q: Can I manually set the model?**

A: Yes, edit `~/.claude/model-tracking.json` directly:
```bash
cat > ~/.claude/model-tracking.json <<'EOF'
{"model": "sonnet", "reason": "manual-override", "context": "Testing", "timestamp": null, "agent": null}
EOF
```

Status line will reflect it on next refresh. (Not recommended for regular use — let the router decide.)

**Q: Does this cost extra?**

A: No. The tracking system is purely informational — it just reads/writes a small JSON file. The underlying model costs are unchanged.

---

## See Also

- **Runbook:** `brain/operations/runbooks/model-tracking.md` (detailed operations guide)
- **Routing Policy:** `brain/ai/policy/routing.md` (how the router decides)
- **Setup Guide:** `~/.claude/MODEL_TRACKING_GUIDE.md` (local reference)
