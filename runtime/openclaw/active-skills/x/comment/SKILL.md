---
name: x_comment
description: Generate 6 reply options for raw pasted replies/comments under Steve's own posts.
user-invocable: true
---

# /comment

Use this command when Steve pastes a raw, unformatted reply/comment under his own post and wants response options.

## Behavior

Before replying, use these files as operating context:

- /home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/SOUL.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/reply-engine.md
- /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/replies-own-posts.md

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

Include variation such as:
- engaging
- witty
- factual
- authority-building
- sharp
- closing

At least one option should be a clean closing reply that does not invite more debate.

## Input

The raw pasted text after `/comment` is the source content.
