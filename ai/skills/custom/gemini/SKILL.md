---
name: gemini
description: Use Gemini CLI for large-context preprocessing, bulk analysis, and free-tier Flash work. Best when input is very large (>100k tokens) or when cost reduction via free tier matters.
---

# /gemini — Gemini CLI Routing

Use this skill to route tasks to Gemini CLI. Gemini is the large-context preprocessing engine in the unified AI system.

## When to use Gemini

Use Gemini when:
- Input is very large (many files, large logs, big diffs) — Flash handles up to 1M tokens in one shot
- Task is bulk analysis or summarization and you want to reduce Claude/Codex token spend
- You need a fast first-pass over a large codebase before acting
- Context compaction: turning raw files into a compact briefing for Claude
- Pure analysis with no interactive coding — prefer free Flash over paid Haiku

## Do not use Gemini

Do not use Gemini for:
- Interactive coding or implementation (use Claude)
- Architecture decisions (use Claude Opus)
- High-stakes code review — auth, migrations, prod (use Codex max or Claude Opus)
- Tasks needing persistent memory (use Claude)
- When a simple cheap-prep (Haiku) on a small context would be sufficient

## Model tiers

| Tier | Model | Free tier | When |
|------|-------|-----------|------|
| **flash** (default) | gemini-2.0-flash | ~1500 RPD, ~1M TPM | Everything — default tier |
| **pro** | gemini-2.5-pro | ~50 RPD | Only when Flash reasoning is insufficient |

Always default to Flash. Pro free tier is limited (~50 RPD) — conserve it.

## Recommended workflow

1. Identify that the task has large context (>100k tokens) or bulk nature
2. Compress the relevant files/context into a Gemini prompt
3. Call the wrapper: `brain/tools/gemini-review.sh '<task + content>'`
4. Gemini returns a compact structured summary
5. Use that summary as input to Claude or Codex for the actual decision/implementation

## Example use cases

- "Summarize these 50 files so I can understand the architecture"
- "Scan this 200k token log file and extract all errors and anomalies"
- "Read the entire codebase and identify where authentication happens"
- "Compress this large diff into key changes for Claude to review"
- "Preprocess these 20 markdown files into a single briefing"

## Invocation

```bash
brain/tools/gemini-review.sh '<prompt with content>' [flash|pro]
```

## Cost profile

- Flash: free tier with very high limits (~1500 RPD, ~1M TPM) — use liberally for preprocessing
- Pro: limited free tier (~50 RPD) — conserve, only for deep reasoning tasks Flash can't handle
- Goal: use Gemini Flash to reduce what Claude and Codex need to process

## Output handling

- Treat Gemini output as preprocessed input for Claude, not final answers
- For large context tasks: Gemini output should be compact enough to fit in Claude's normal context
- For analysis tasks: findings should be actionable bullet points
- If output is low-value, don't retry — try a different approach
