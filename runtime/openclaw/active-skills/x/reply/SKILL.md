---
name: x_reply
description: Generate 6 reply options for raw pasted tweets/comments from the feed.
user-invocable: true
---

# /reply

Use this command when Steve pastes a raw, unformatted tweet/comment from his feed and wants reply options.

## Behavior

Before replying, use these files as operating context:

- /home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/SOUL.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/reply-engine.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/replies-feed.md

First, form a short INTERNAL trend brief from free public sources relevant to founders, non-technical builders, SaaS, AI agents, vibe coding, shipping speed, and distribution.
Do not output the trend brief.
Use it only to slightly bias wording, angles, and topical freshness.

## Output Rules

Return exactly 6 reply options.

- output only the reply text
- no intro
- no outro
- no numbering
- no bullets
- no labels
- blank line between each reply
- every reply must be copy-paste ready

## Style Mix

Make the 6 options clearly different, with a mix of:
- witty
- sharp
- humorous
- factual
- engaging
- conversational

Avoid repetition in structure, rhythm, and wording.

## Input

The raw pasted text after `/reply` is the source content.
