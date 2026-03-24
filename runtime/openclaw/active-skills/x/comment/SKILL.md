---
name: x_comment
description: Generate 6 categorised reply options for raw pasted replies/comments under Steve's own posts.
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

## Vibe Detection

Before generating replies, analyse the pasted comment and detect its energy:
- Is this person agreeing, disagreeing, asking a question, being sarcastic, adding value, trolling?
- What kind of response would make this commenter feel seen and keep the thread alive?

Use this detection to calibrate the 6 replies. They should match the energy while still offering Steve a choice. If you cannot detect the vibe, default to 6 clearly different categories.

## Output Format

Format every response as follows:

1. Start with a bold title summarising the comment (1 line)
2. Then 6 numbered reply options, each with:
   - A **bold category label** (e.g. **💬 Warm**, **🎭 Witty**)
   - The reply text inside a code block (single backtick-fenced block per reply)
   - Code blocks make each reply click-to-copy in Telegram and web

### Example output structure:

**Responding to comment — "Summary of what they said"**

**1. 💬 Warm**
```
Genuine, appreciative response here.
```

**2. 🎭 Witty**
```
Light humor that keeps the thread fun.
```

**3. 🧠 Insightful**
```
Adds depth to what they said.
```

**4. 🎯 Direct**
```
Straight answer, no fluff.
```

**5. 🤝 Amplify**
```
Makes their point stronger — they look good.
```

**6. ✅ Close**
```
Clean wrap-up, no more debate needed.
```

## Category Labels

Choose 6 from this pool (or invent fitting ones). Always include at least one closing option:

- 💬 Warm
- 🎭 Witty
- 🧠 Insightful
- 🎯 Direct
- 🤝 Amplify
- ✅ Close
- 😂 Comedy
- 📊 Factual
- 💡 Reframe
- 🫡 Respectful correction
- 🔥 Sharp
- 🤷 Casual

Pick categories that fit the commenter's energy. Don't force humor on a serious question. Don't force authority on a casual "nice post" comment.

## Anti-AI Rules

Follow ALL rules in voice-rules.md. Key reminders:
- No "great point", "totally agree", "couldn't agree more", "well said"
- No "furthermore", "it's crucial", "the key is"
- At least 1 reply should have casual formatting (lowercase, fragment, missing period)
- Include emotional range — gratitude, humor, directness, not just generic positivity
- Sound like a real person responding, not a brand account

## Comment Strategy

- Comments under your own posts are relationship-building moments
- Make commenters feel seen — amplifying their point gets more engagement than re-centering yourself
- Short, genuine acknowledgments often beat longer responses
- When disagreement happens, reframe rather than defend
- Always include a clean closing option for when the thread is done

## Input

The raw pasted text after `/comment` is the source content.
