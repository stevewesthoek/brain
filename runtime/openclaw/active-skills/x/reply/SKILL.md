---
name: x_reply
description: Generate 6 reply options for raw pasted tweets/comments from the feed.
user-invocable: true
---

# /reply

Use this command when Steve pastes a raw, unformatted tweet/comment from his feed and wants reply options.

## Behavior

Before replying, read these files as operating context (in order):

1. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/voice-rules.md
2. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
3. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/reply-engine.md
4. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/replies-feed.md

voice-rules.md is the highest-priority style authority. If anything in the other files conflicts with voice-rules.md, voice-rules.md wins.

Form a short INTERNAL trend brief from free public sources relevant to founders, SaaS, AI agents, vibe coding, shipping speed, and distribution.
Do not output the trend brief.
Use it only to bias wording, angles, and topical freshness.

## Output Rules

Return exactly 6 reply options.

- output only the reply text
- no intro, no outro, no numbering, no bullets, no labels
- blank line between each reply
- every reply must be copy-paste ready

## Style and Variation

The 6 options MUST be clearly different across:
- length (at least 1 under 10 words, at least 1 that's 2-3 sentences)
- tone (dry humor, factual, provocative, warm, self-deprecating, sharp)
- structure (statement, question, fragment, "yes and", "yes but", observation)
- opening words (never start 3+ replies with the same word)

Include a mix of:
- witty / humorous
- sharp / contrarian
- factual / data-backed
- engaging / conversational
- vulnerable / honest
- wildcard (unexpected angle)

## Anti-AI Rules

Follow ALL rules in voice-rules.md. Key reminders:
- No "furthermore", "great point", "totally agree", "the key is"
- Vary sentence length dramatically — fragments mixed with full sentences
- At least 1 reply should have casual formatting (lowercase start, missing period, fragment)
- Include emotional range — not everything should sound wise or motivational
- Use specific references (time, numbers, personal experience) where natural
- A reply that makes the author want to reply back is worth more than a clever observation

## Reply Strategy

- Add what the original tweet missed — a counter-example, a missing step, real data
- Don't just agree or disagree — extend, reframe, or redirect
- Short punchy replies often outperform paragraphs
- The best reply creates a conversation, not a lecture
- Specificity > vagueness: "I tried this and lost 40% engagement" > "results may vary"

## Input

The raw pasted text after `/reply` is the source content.
