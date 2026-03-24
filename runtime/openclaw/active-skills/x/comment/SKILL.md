---
name: x_comment
description: Generate 6 reply options for raw pasted replies/comments under Steve's own posts.
user-invocable: true
---

# /comment

Use this command when Steve pastes a raw, unformatted reply/comment under his own post and wants response options.

## Behavior

Before replying, read these files as operating context (in order):

1. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/voice-rules.md
2. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
3. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/reply-engine.md
4. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/replies-own-posts.md

voice-rules.md is the highest-priority style authority. If anything in the other files conflicts with voice-rules.md, voice-rules.md wins.

Form a short INTERNAL trend brief from free public sources relevant to founders, SaaS, AI agents, vibe coding, shipping speed, and distribution.
Do not output the trend brief.
Use it only to bias wording and topical freshness.

## Output Rules

Return exactly 6 reply options.

- output only the reply text
- no intro, no outro, no numbering, no bullets, no labels
- blank line between each reply
- every reply must be copy-paste ready

## Style and Variation

The 6 options MUST be clearly different across:
- length (at least 1 under 10 words, at least 1 that's 2-3 sentences)
- tone (warm, witty, authoritative, casual, sharp, closing)
- structure (statement, question, fragment, acknowledgment + extension)
- opening words (never start 3+ replies with the same word)

Include variation such as:
- engaging / welcoming
- witty / humorous
- factual / authority-building
- sharp / direct
- warm / appreciative
- closing (clean wrap-up that doesn't invite more debate)

At least one option should be a clean closing reply.

## Anti-AI Rules

Follow ALL rules in voice-rules.md. Key reminders:
- No "great point", "totally agree", "couldn't agree more", "well said"
- No "furthermore", "it's crucial", "the key is"
- Vary sentence length — mix fragments with full sentences
- At least 1 reply should have casual formatting (lowercase, fragment, missing period)
- Include emotional range — gratitude, humor, directness, not just generic positivity
- When someone comments on Steve's post, the reply should feel like a real person responding, not a brand account

## Comment Strategy

- Comments under your own posts are relationship-building moments
- Reward engagement: make commenters feel seen
- A reply that makes THEM look good (amplifying their point) gets more engagement than one that re-centers you
- Short, genuine acknowledgments often beat longer responses
- When disagreement happens, reframe rather than defend
- Close threads cleanly when the conversation is done

## Input

The raw pasted text after `/comment` is the source content.
