# Human Writing Guardrails Adoption

**Status:** Active architecture  
**Last reviewed:** 2026-05-09  
**Decision:** Do not install a separate default `humanizer` skill. Instead, use a shared writing standard referenced by text-producing orchestrators.

---

## Why This Exists

Steve wants AI-generated writing to sound more humane, natural, specific, and audience-aware across multiple workflows:

- Bible research
- apologetics letters
- Bible stories for Says the Bible
- landing pages
- websites
- marketing copy
- YouTube scripts
- social posts
- captions
- user-facing documentation

The trigger for this review was the external `blader/humanizer` repository. It provides useful anti-AI-writing patterns, but its value is mostly a checklist of writing guardrails rather than a necessary runtime dependency.

---

## Decision

Use a central standard:

```text
operations/standards/human-writing-guardrails.md
```

Reference it from relevant orchestrators.

Do not add a new always-on `humanizer` skill to the default profile.

---

## Why Not Install A Separate Humanizer Skill?

Reasons:

1. **Avoid active-skill bloat.** The system intentionally keeps a compact default active set for Claude Code, Codex, Gemini, and IDEs.
2. **Avoid style overriding truth.** Humanizing too early can make weak, uncertain, or unsourced claims sound more persuasive than they deserve.
3. **Avoid duplicated rules.** A central standard is easier to maintain than copying a full humanizer prompt into many skills.
4. **Preserve domain methods.** Bible research needs exegesis; marketing needs positioning; video needs platform pacing. Human polish should not replace those methods.
5. **Reduce dependency risk.** External skills may change, disappear, or encode assumptions that do not fit Steve's voice.

---

## Architecture

```text
Domain method first
  → research / exegesis / strategy / script structure / design direction
Quality checks second
  → evidence / logic / source / theology / offer clarity / platform fit
Human writing polish last
  → remove AI tells, improve rhythm, preserve voice
```

Human-writing guardrails are applied only at the final human-facing output stage.

---

## Updated Orchestrators

The following skills now reference the shared standard:

```text
ai/skills/custom/research/SKILL.md
ai/skills/custom/bible-research/SKILL.md
ai/skills/custom/web-design/SKILL.md
ai/skills/custom/video/SKILL.md
ai/skills/custom/viral-flow/SKILL.md
ai/skills/custom/stb-pipeline/SKILL.md
```

### Research

Uses human polish for final reports, briefs, recipient-facing responses, and public research outputs after source/evidence/logic checks.

### Bible Research

Uses human polish for Bible stories, devotionals, apologetics letters, sermon drafts, and teaching material after exegesis, theology, and source checks.

### Web Design

Uses human polish for landing-page copy, CTAs, section headlines, UX copy, product messaging, and marketing text after positioning and layout are clear.

### Video

Uses human polish for scripts, narration, captions, titles, descriptions, and community posts after the message, platform, and format are clear.

### Viral Flow

Uses human polish for topics, angles, hooks, scripts, captions, and post copy after strategy selection.

### Says the Bible Pipeline

Uses human polish for Bible bedtime stories after Scripture/story grounding. The goal is calm, reverent, sleep-appropriate, human-sounding narration without invented doctrine or generic devotional language.

---

## What The Guardrails Are Allowed To Change

They may improve:

- sentence rhythm
- specificity
- warmth
- clarity
- transitions
- natural voice
- over-structured AI patterns
- generic marketing language
- repeated em dashes
- robotic headings
- generic filler phrases

---

## What The Guardrails Must Not Change

They must not:

- add new claims
- remove caveats
- hide uncertainty
- change doctrine
- change Bible interpretation
- weaken source requirements
- change the offer or promise in marketing copy
- turn cautious research into persuasive overclaiming
- make apologetics harsher or more combative
- overwrite Steve's intended voice

---

## Maintenance Rule

When adding a new text-producing orchestrator, decide whether it needs human-writing guardrails.

If yes:

1. Reference `operations/standards/human-writing-guardrails.md` with one short paragraph.
2. State clearly when the guardrails run.
3. State clearly what they must not override.
4. Do not copy the full standard into the skill.

---

## Future Optional Work

A dormant `human-writing` or `writing-polish` skill may be added later only if:

- repeated workflows need a dedicated invocation
- the default active set remains compact
- it is not used before evidence/source/theology/strategy checks
- it points to the central standard instead of duplicating it

For now, the shared standard is sufficient and cleaner.
