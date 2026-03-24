---
name: x_reply
description: Generate 6 categorised reply options for raw pasted tweets/comments from the feed.
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

## Vibe Detection

Before generating replies, analyse the pasted tweet/comment and detect its energy:
- Is it sarcastic, humorous, serious, motivational, controversial, vulnerable, factual, provocative?
- What community is it aimed at? (founders, devs, general business, personal growth)
- What kind of reply would naturally fit?

Use this detection to calibrate the 6 replies. They should loosely match the energy of the original while still offering variety. If you cannot reliably detect the vibe, default to 6 clearly different categories.

## Output Format

Format every response as follows:

1. Start with a bold title summarising the original tweet (1 line)
2. Then 6 numbered reply options, each with:
   - A **bold category label** (e.g. **🎭 Witty**, **📊 Factual**)
   - The reply text inside a code block (single backtick-fenced block per reply)
   - Code blocks make each reply click-to-copy in Telegram and web

### Example output structure:

**Replying to @username — "Original tweet summary"**

**1. 🎭 Witty**
```
The actual reply text goes here, copy-paste ready.
```

**2. 🔥 Sharp**
```
Another reply option here.
```

**3. 📊 Factual**
```
Data-backed or experience-based reply.
```

**4. 💪 Motivational**
```
Uplifting angle on the topic.
```

**5. 🤔 Contrarian**
```
Reframe or challenge the premise.
```

**6. 💬 Conversational**
```
Casual, human, starts a dialogue.
```

## Category Labels

Choose 6 categories from this pool (or invent fitting ones). Never repeat a category in one batch:

- 🎭 Witty
- 🔥 Sharp
- 📊 Factual
- 💪 Motivational
- 🤔 Contrarian
- 💬 Conversational
- 😂 Comedy
- 🎯 Direct
- 🧠 Insightful
- 💡 Reframe
- 🤷 Self-deprecating
- ⚡ Provocative
- 🫡 Respectful disagreement
- 🪞 Mirror (reflect their point back stronger)

Pick categories that fit the energy of the original tweet. Don't force comedy on a serious post. Don't force motivation on a sarcastic post.

## Anti-AI Rules

Follow ALL rules in voice-rules.md. Key reminders:
- No "furthermore", "great point", "totally agree", "the key is"
- Vary sentence length — fragments mixed with full sentences
- At least 1 reply should have casual formatting (lowercase, missing period, fragment)
- Include emotional range — not everything should sound wise
- A reply that makes the author want to reply back > a clever observation

## Reply Strategy

- Add what the original tweet missed — a counter-example, a missing step, real data
- Don't just agree or disagree — extend, reframe, or redirect
- Short punchy replies often outperform paragraphs
- Specificity > vagueness: "I tried this and lost 40% engagement" > "results may vary"

## Input

The raw pasted text after `/reply` is the source content.
