# Telegram Workflow for X

This file defines how the assistant should handle tweet drafting and follow-up commands in Telegram.

## Goal

Use Telegram as the working interface for X/Twitter drafting.

Steve should be able to:
- receive 6 ready-to-post tweets
- copy-paste them directly into X
- ask for rewrites quickly
- avoid extra formatting noise

---

## Output Rules for Daily Tweet Delivery

When sending daily tweet drafts in Telegram:

- output ONLY the tweet text
- no intro
- no outro
- no numbering
- no bullets
- no labels like "Tweet 1"
- no quotes around tweets
- no metadata
- separate each tweet with exactly one blank line
- each tweet must be copy-paste ready for X

---

## Follow-up Command Rules

After sending tweet drafts, the assistant should understand commands like:

- rewrite 2 sharper
- rewrite 4 shorter
- rewrite 1 more contrarian
- rewrite 3 with stronger hook
- make 5 more founder-focused
- make 6 simpler
- 2 post
- 3 schedule 18:00
- reject 4

Interpretation:
- the number refers to the tweet position from the most recent batch
- rewrite commands should return ONLY the rewritten tweet text
- rewritten output must also be copy-paste ready
- if a command is ambiguous, ask one short clarifying question

---

## Rewrite Rules

When rewriting a tweet:

- preserve the core idea unless Steve asks for a different angle
- improve hook strength first
- remove fluff
- increase clarity
- keep it concise
- maintain Steve’s tone

Do not:
- explain what changed
- add commentary
- add labels
- return multiple versions unless asked

---

## Posting Rules

Default behavior:
- the assistant drafts only
- the assistant does NOT post automatically
- the assistant does NOT schedule automatically
- the assistant requires explicit approval

If Steve says:
- "2 post" → treat that as explicit approval to post tweet 2
- "3 schedule 18:00" → treat that as explicit approval to schedule tweet 3 at 18:00
- "reject 4" → discard tweet 4 and do nothing else

If posting automation is not configured:
- respond with the exact tweet text only, ready to copy-paste
- do not pretend it was posted

---

## Priorities

Optimize for:
1. copy-paste usability
2. speed
3. strong hooks
4. clarity
5. reply generation

Not for:
- fancy formatting
- explanations
- dashboard-style output
- unnecessary structure

---

## Principle

Telegram is the operating console.
The tweet itself is the payload.
Everything else is noise.


---

## Daily Tweet Review Workflow

When sending the daily 6 tweets in Telegram:

- send only the 6 tweets
- no metadata
- no labels
- no numbering
- blank line between tweets

If Steve replies with:
- "try again"
- "regenerate"
- "make these more human"
- "more variation"
- "more salesy"
- "less polished"
- "make one more conversational"
- "make one more founder-focused"

Then the assistant should regenerate the batch using the existing X rules and stronger variation.
