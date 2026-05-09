# Human Writing Guardrails

**Status:** Active standard  
**Last reviewed:** 2026-05-09  
**Scope:** Research outputs, apologetics letters, Bible stories, marketing copy, landing pages, video scripts, social copy, captions, thumbnails, and user-facing documentation.

---

## Purpose

AI-generated writing often becomes polished but inhuman: inflated, generic, repetitive, over-structured, too symmetrical, too promotional, or too obviously "AI-written."

This standard defines the reusable guardrails that all text-producing orchestrators should apply when creating human-facing output.

This is intentionally a standard, not a standalone always-on skill. The goal is to improve writing quality across existing orchestrators without bloating the default active skill set.

---

## Core Principle

Human polish is a **final-stage quality pass**, not a replacement for truth, evidence, exegesis, strategy, design, or argument quality.

Use this sequence:

```text
truth / source / structure / strategy first
human writing polish last
```

Never make a claim sound more certain than the research allows just because the sentence reads better.

---

## When To Apply

Apply these guardrails whenever the output is meant for a human audience:

- apologetics letters
- Bible stories
- Bible-study material
- sermons or devotionals
- landing-page copy
- marketing copy
- website section copy
- product positioning
- YouTube scripts
- short-form video scripts
- thumbnails and titles
- social posts
- emails
- Google Docs intended for sharing
- final research reports or briefs

Do not apply aggressively to:

- raw research notes
- evidence ledgers
- claim ledgers
- audit files
- source maps
- technical runbooks
- exact legal/compliance language
- code comments where precision matters more than voice

---

## Non-Negotiable Safety Rule

Humanizing must never:

- add new claims
- remove needed caveats
- hide uncertainty
- weaken citations
- change doctrine
- change Bible interpretation
- make weak evidence sound strong
- make marketing claims less truthful
- make apologetics more combative
- overwrite the user's actual voice

If accuracy and smoothness conflict, accuracy wins.

---

## Human Writing Checklist

Before finalizing human-facing text, check:

### 1. Voice

- Does this sound like a real person speaking to a real audience?
- Does it preserve Steve's intended voice, convictions, and tone?
- Is it direct without sounding mechanical?
- Is it warm without becoming sentimental?

### 2. Specificity

Replace generic claims with concrete ones.

Avoid:

```text
Transform your workflow with seamless AI-powered solutions.
```

Prefer:

```text
Turn messy customer conversations into clear follow-up tasks.
```

### 3. Sentence Rhythm

Avoid same-length, same-shape paragraphs.

Use a natural mix of:

- short sentences
- medium explanations
- occasional longer reasoning sentences when needed

Do not force every idea into a neat three-part rhythm.

### 4. Structure

Use structure to help the reader, not to show that the AI is organized.

Avoid excessive:

- numbered lists
- parallel headings
- repeated section formulas
- "not X, but Y" constructions
- symmetrical three-part claims

### 5. Transitions

Avoid generic AI transitions:

```text
Moreover
Furthermore
In conclusion
It is important to note
This highlights
This underscores
```

Prefer natural connective tissue:

```text
That matters because...
This is where I think the question shifts.
Here is the part I would put more carefully.
So the issue is not...
```

### 6. Punctuation

Avoid em dash overuse. Prefer commas, colons, semicolons, parentheses, or separate sentences.

Em dashes are not banned everywhere, but repeated em dashes are a common AI-writing tell.

### 7. Claims

Every strong claim must be one of:

- sourced
- obviously experiential
- clearly framed as opinion
- clearly framed as inference
- softened
- removed

Do not use style to cover evidence gaps.

### 8. Tone

For apologetics and Bible content:

- gentle
- respectful
- patient
- clear
- non-quarrelsome
- not sarcastic
- not debate-bro
- not preachy unless the format explicitly calls for preaching

For marketing:

- plain
- concrete
- benefit-aware
- not hype-driven
- not manipulative
- not generic SaaS copy

For Bible stories:

- reverent
- simple
- vivid
- text-faithful
- emotionally concrete
- not melodramatic
- not over-modernized
- not moralizing beyond the passage

---

## Common AI Writing Tells To Remove

Watch for and rewrite:

- "elevate"
- "seamless"
- "unlock"
- "unleash"
- "delve"
- "game-changer"
- "next-gen"
- "robust"
- "cutting-edge"
- "transformative"
- "revolutionize"
- "in today's fast-paced world"
- "whether you're X or Y"
- "not just X, but Y"
- "it's about more than X"
- "this isn't just..."
- "imagine a world where..."
- "the future of..."
- "at the intersection of..."

Do not mechanically ban words if the user's real voice uses them naturally, but treat them as warning signs.

---

## Domain-Specific Application

### Research / Apologetics

Use after evidence and logic passes are complete.

Final text should:

- preserve concessions
- avoid overclaiming
- distinguish evidence, inference, and opinion
- steelman the other side
- sound like a real letter, not a debate script
- keep humility visible

### Bible Research / Bible Stories

Use after exegesis and theology are checked.

Final text should:

- preserve biblical context
- avoid proof-texting
- avoid invented details unless clearly marked as imaginative retelling
- keep emotional language tied to the passage
- avoid turning every story into a generic life lesson

### Marketing / Websites

Use after positioning and offer clarity are set.

Final copy should:

- name the actual pain
- state the actual benefit
- avoid generic SaaS claims
- use concrete nouns and verbs
- sound like a founder speaking clearly, not an agency template

### Video / YouTube / Social

Use after the message and platform format are clear.

Scripts should:

- sound speakable out loud
- avoid perfect essay structure
- use natural pauses
- avoid hype unless the brand intentionally calls for it
- make the hook human, not clickbait
- keep titles and captions specific

### Says the Bible

Use after story selection and Scripture grounding.

Stories should:

- be calm, reverent, and sleep-appropriate
- avoid modern slang
- avoid excessive drama
- avoid doctrinal over-explanation
- use sensory detail sparingly
- make the listener feel held, not lectured
- keep repeated sleep-loop lines simple and memorable

---

## Final Pass Prompt Pattern

Use this pattern inside orchestrators:

```text
Run a final human-writing polish pass.

Rules:
- Do not add new claims.
- Do not remove needed caveats.
- Do not change the doctrine, argument, source support, or strategy.
- Preserve the user's voice and intended audience.
- Remove generic AI phrasing, inflated claims, repetitive structure, and unnatural transitions.
- Make the text sound like a thoughtful human wrote it for this specific audience.
```

---

## Why This Is Not A Separate Default Skill

A standalone humanizer skill would add another always-on capability and could accidentally be applied too early.

The better architecture is:

```text
orchestrators keep their domain method
human-writing guardrails apply at final output stage
```

This preserves the minimal active skill set while improving writing quality everywhere it matters.

---

## Maintenance Rule

When adding a new text-producing orchestrator, reference this standard if the output is human-facing.

When updating writing quality rules, update this file first, then add only short references in the relevant orchestrator skills.
