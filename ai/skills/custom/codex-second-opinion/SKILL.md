---
name: codex-second-opinion
description: Use Codex CLI as a tightly controlled second-opinion reviewer for code, debugging, and implementation risk checks. Do not use it as the default coding engine.
---

# codex-second-opinion

Use this skill when a second opinion is useful, but only in controlled cases.

## When to use this skill

Use Codex only when:
- Claude is uncertain about a code change
- a bug persists after 1–2 solid attempts
- there is a meaningful implementation tradeoff
- a review of a proposed patch would reduce risk
- the user explicitly asks for a second opinion

## Do not use this skill

Do not use Codex:
- as the default implementation engine
- for every task
- in loops
- for broad architecture discovery unless the user explicitly asks
- when the task is trivial and Claude is already confident

## Cost-control rules

- Maximum 1 Codex call per task by default
- Maximum 2 Codex calls for debugging if the first response was genuinely useful
- Never chain repeated Codex calls without a clear reason
- Summarize the relevant context before calling Codex
- Keep the prompt compact and focused
- Use `reasoning_effort="high"` (not `xhigh`) — sufficient for second opinion, lower cost

## Recommended workflow

1. First solve or analyze the task with Claude
2. If confidence is low or the task is risky, compress the relevant context
3. Call the wrapper script: `brain/tools/codex-review.sh '<compressed context>'`
4. Ask Codex for:
   - likely bugs
   - missing edge cases
   - simpler alternatives
   - risk review
5. Integrate only the useful parts
6. Do not blindly trust Codex output

## Example use cases

- "Review this patch for hidden bugs before I apply it"
- "Give me a second opinion on this failing test fix"
- "Check whether this refactor misses edge cases"
- "Look at this implementation plan and tell me what is weak"

## Invocation example

```bash
brain/tools/codex-review.sh "Review this patch: <summary or code snippet>"
```

## Output handling rules

- Treat Codex as advisory, not authoritative
- Prefer concise findings over full rewrites
- If Codex output is vague or low-value, stop there — do not retry
- Fold only durable insights into memory or repo docs
