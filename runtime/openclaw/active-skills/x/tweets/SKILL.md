---
name: x_tweets
description: Generate 6 tweet options for the current posting window using ProBot context and trend scouting.
user-invocable: true
---

# /tweets

Use this command when Steve wants a fresh batch of tweet drafts on demand.

## Behavior

Before generating tweets, use these files as operating context:

- /home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/SOUL.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/daily-output.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/telegram-workflow.md
- /home/ubuntu/.openclaw/workspace/brain/organisations/prochat/growth/posting.md

First, form a short INTERNAL trend brief from free public web sources relevant to:
- founders
- non-technical builders
- SaaS
- AI agents
- vibe coding
- shipping speed
- distribution

Do not output the trend brief.
Use it only to slightly improve topic freshness, wording, and angle selection.

## Output Rules

Generate exactly 6 tweet drafts.

- output only the tweet text
- no intro
- no outro
- no numbering
- no bullets
- no labels
- no metadata
- blank line between tweets
- every tweet must be directly copy-paste ready for X

## Content Rules

The 6 tweets must be clearly different in:
- structure
- tone
- angle
- rhythm
- style

Include a mix of:
- sales
- value
- conversational
- personal
- wildcard

Avoid repetition.

## Input

Any extra text after /tweets should be treated as additional instruction for this batch.

Examples:
- /tweets
- /tweets more salesy
- /tweets more human
- /tweets stronger hooks
- /tweets make them more founder-focused
