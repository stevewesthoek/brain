# Model Tracking System

Real-time dynamic model detection with reasons for why each model is in use.

## Status Line Display

Your status line now shows: `directory | model reason [agent]`

**Examples:**
- `brain | haiku` — Normal Haiku execution (default)
- `brain | sonnet ↑ (complex) [coder-default]` — Escalated to Sonnet for complex coding
- `brain | opus ↑↑ (hard) [deep-architect]` — Escalated to Opus for hard architecture
- `brain | haiku ⊙ (plan) | ▓▓░░░░░ 22%` — In planning mode; context is 22% full

## Reason Badges

| Badge | Reason | Meaning |
|-------|--------|---------|
| `↑` | escalation-complexity | Haiku struggled; escalated to Sonnet for multi-file or deep reasoning |
| `↑↑` | escalation-high-complexity | Sonnet insufficient; escalated to Opus for architecture/high blast-radius |
| `⊙` | plan-mode | In planning phase (gathering info, designing approach) |
| `◊` | review-mode | Using `/review` skill for PR review |
| `⚙` | preprocessing-triage | Haiku preprocessing/compressing context before main task |
| `⚙` | preprocessing-large-context | Gemini Flash (free tier) summarizing huge inputs (1M token window) |
| `🔍` | research-mode | Web scraping/research via `/firecrawl` |
| `⬆` | deploy-mode | Running `/ship` or `/land-and-deploy` |

## How It Works

**Triggering model changes:**
1. **User input detection** — Hooks scan your prompts for keywords (`/review`, `Agent(`, `plan`, etc.)
2. **Agent completion** — PostToolUse hooks detect when Agents (Sonnet, Opus) actually run
3. **Real-time update** — Status line reads the tracking file every refresh

**Automatic reset:**
- When you run `/Stop` to end a task, model tracking resets to Haiku
- Each new task starts fresh at the cheapest tier

## Tracking File

Location: `~/.claude/model-tracking.json`

```json
{
  "model": "sonnet",
  "reason": "escalation-complexity",
  "context": "Complex multi-file coding task",
  "timestamp": "2026-04-14T10:30:45Z",
  "agent": "coder-default"
}
```

You can inspect this anytime to see the current model state.

## Cost Awareness

Use this system to stay aware of costs as you work:
- **Haiku** (default) — ~25× cheaper than Opus
- **Sonnet** (~5× cheaper than Opus) — used when Haiku insufficient
- **Opus** — only for hard architecture/high blast-radius

Each badge in your status line tells you whether you're still in the cheapest tier (no badge = Haiku is handling it) or whether escalation was necessary.

## Quick Debug

If the status line isn't showing model changes:
1. Check that `~/.claude/model-tracking.json` exists (should be created automatically)
2. Verify hooks are running: `bash /Users/Office/.claude/hooks/model-tracking-hook.sh` with sample input
3. Ensure settings.json has the hooks registered (check UserPromptSubmit and Stop sections)
