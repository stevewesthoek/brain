---
name: x_tweets
description: Generate 6 tweet options for the current posting window using ProBot context and trend scouting.
user-invocable: true
---

# /tweets

Use this command when Steve wants a fresh batch of tweet drafts on demand.

## Behavior

Before generating tweets, read these files as operating context (in order):

1. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/voice-rules.md
2. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/system.md
3. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/daily-output.md
4. /home/ubuntu/.openclaw/workspace/brain/ai/publishing/x/telegram-workflow.md
5. /home/ubuntu/.openclaw/workspace/brain/organisations/prochat/growth/posting.md

voice-rules.md is the highest-priority style authority. If anything in the other files conflicts with voice-rules.md, voice-rules.md wins.

Form a short INTERNAL trend brief from free public web sources relevant to:
- founders, indie hackers, solo devs
- SaaS, micro-SaaS
- AI agents, vibe coding
- shipping speed, distribution

Do not output the trend brief.
Use it only to improve topic freshness, wording, and angle selection.

## Output Rules

Generate exactly 6 tweet drafts.

- output only the tweet text
- no intro, no outro, no numbering, no bullets, no labels, no metadata
- blank line between tweets
- every tweet must be directly copy-paste ready for X

## Content Rules

The 6 tweets MUST be clearly different across:
- structure (statement, question, fragment, list, observation, story)
- tone (sharp, conversational, vulnerable, provocative, educational, humorous)
- angle (different topic or perspective per tweet)
- length (at least 1 under 15 words, at least 1 that's 2-3 lines)
- rhythm (vary sentence length within tweets — fragments + full sentences)

Use the 3-bucket strategy:
- 2 tweets: Authority (expert insights, lessons, frameworks)
- 2 tweets: Personality (relatable struggles, self-deprecation, honest takes)
- 2 tweets: Shareable (broadly applicable, quotable, makes the reader look smart for sharing)

### Hook Variety
Rotate across these hook types — never use the same type twice in one batch:
- Bold numerical claim
- Vulnerability confession
- Pattern interrupt ("Everyone says X. They're wrong")
- Identity targeting ("If you have under 1k followers...")
- Specific pain point
- Question that creates an information gap

## Anti-AI Rules

Follow ALL rules in voice-rules.md. Key reminders:
- No "furthermore", "the key is", "it's crucial", "game-changer", "unlock"
- No motivational fluff — if it sounds like a LinkedIn post, kill it
- At least 1 tweet should have imperfect formatting (lowercase, fragment, trailing off)
- At least 1 tweet should express doubt, frustration, or honest failure
- Use specifics: numbers, days, tools, real scenarios — never vague platitudes
- If all 6 tweets sound "wise", the batch failed

## Input

Any extra text after /tweets should be treated as additional instruction for this batch.

Examples:
- /tweets
- /tweets more salesy
- /tweets more human
- /tweets stronger hooks
- /tweets make them more founder-focused
