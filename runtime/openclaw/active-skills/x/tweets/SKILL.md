---
name: x_tweets
description: Generate 6 categorised tweet options for the current posting window using ProBot context and trend scouting.
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

## Output Format

Format every response as follows:

1. Start with a bold title line (e.g. **6 Fresh Tweets — [date or theme]**)
2. Then 6 numbered tweet options, each with:
   - A **bold category label** (e.g. **🔥 Authority**, **🤷 Personal**)
   - The tweet text inside a code block (single backtick-fenced block per tweet)
   - Code blocks make each tweet click-to-copy in Telegram and web

### Example output structure:

**6 Fresh Tweets**

**1. 🔥 Authority**
```
Expert insight or lesson goes here. Short, sharp, no fluff.
```

**2. 🤷 Personal**
```
Relatable struggle or honest take here.
```

**3. ⚡ Provocative**
```
Pattern interrupt or contrarian take.
```

**4. 💬 Conversational**
```
Question or observation that starts dialogue.
```

**5. 💡 Shareable**
```
Broadly quotable, makes the reader look smart for sharing.
```

**6. 🎲 Wildcard**
```
Unexpected angle, different energy from the rest.
```

## Category Labels

Each batch MUST use 6 different categories. Choose from this pool or invent fitting ones:

### Core categories (use at least 3 per batch):
- 🔥 Authority — expert insight, lesson, framework
- 🤷 Personal — relatable struggle, self-deprecation, honest take
- 💡 Shareable — broadly quotable, viral potential

### Supplementary categories (fill the remaining 3):
- ⚡ Provocative — contrarian, pattern interrupt
- 💬 Conversational — question, starts dialogue
- 😂 Comedy — dry humor, industry joke
- 📊 Data — specific numbers, results, metrics
- 🎯 Sales — product or offer angle (subtle, not pushy)
- 🧠 Insight — reframe or non-obvious observation
- 🪞 Vulnerability — doubt, failure, messy process
- 🎲 Wildcard — unexpected angle, different energy

Never repeat a category in one batch.

## Content Rules

The 6 tweets MUST be clearly different across:
- structure (statement, question, fragment, list, observation, story)
- tone (matches the category label)
- angle (different topic or perspective per tweet)
- length (at least 1 under 15 words, at least 1 that's 2-3 lines)
- rhythm (vary sentence length within tweets)

### Hook Variety
Rotate across these hook types — never use the same type twice in one batch:
- Bold numerical claim
- Vulnerability confession
- Pattern interrupt
- Identity targeting
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
